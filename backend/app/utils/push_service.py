import json
import logging
from sqlalchemy.orm import Session

# MONKEY PATCH: Resolve cryptography class vs instance compatibility bug in older py-vapid versions
try:
    from cryptography.hazmat.primitives.asymmetric import ec
    _orig_derive = ec.derive_private_key
    _orig_generate = ec.generate_private_key

    def patched_derive_private_key(private_value, curve, *args, **kwargs):
        if isinstance(curve, type):
            try:
                curve = curve()
            except Exception:
                pass
        return _orig_derive(private_value, curve, *args, **kwargs)

    def patched_generate_private_key(curve, *args, **kwargs):
        if isinstance(curve, type):
            try:
                curve = curve()
            except Exception:
                pass
        return _orig_generate(curve, *args, **kwargs)

    ec.derive_private_key = patched_derive_private_key
    ec.generate_private_key = patched_generate_private_key
except Exception as e:
    pass

from pywebpush import webpush, WebPushException
from app.config import settings
from app.hr_models import HRPushSubscription

logger = logging.getLogger(__name__)

def send_push_to_user(
    user_id: int,
    title: str,
    message: str,
    reference_type: str = None,
    reference_id: int = None,
    db: Session = None
):
    """
    Query all push subscriptions for a user and trigger web push notifications using pywebpush.
    Also sends native FCM push notifications if fcm_token is registered on the User record.
    Automatically removes expired/invalid web subscriptions from the database.
    """
    if not db:
        logger.error("No DB session provided to send_push_to_user")
        return

    # 1. Native FCM Push Notification
    try:
        from app.models import User
        from app.fcm import send_fcm_push
        
        user = db.query(User).filter(User.id == user_id).first()
        if user and user.fcm_token:
            data_payload = {}
            if reference_type:
                data_payload["type"] = reference_type
            if reference_id:
                data_payload["id"] = str(reference_id)
                
            logger.info(f"Sending native FCM push notification to user {user_id}...")
            send_fcm_push(
                device_token=user.fcm_token,
                title=title,
                body=message,
                data=data_payload
            )
    except Exception as fcm_ex:
        logger.error(f"Failed to send native FCM push to user {user_id}: {fcm_ex}")

    # 2. Web Push Notification (PWA/Browser)
    subscriptions = db.query(HRPushSubscription).filter(HRPushSubscription.user_id == user_id).all()
    if not subscriptions:
        return

    # Create push payload
    payload = json.dumps({
        "title": title,
        "body": message,
        "url": "/hr/notifications",
        "reference_type": reference_type,
        "reference_id": reference_id
    })

    for sub in subscriptions:
        subscription_info = {
            "endpoint": sub.endpoint,
            "keys": {
                "p256dh": sub.p256dh,
                "auth": sub.auth
            }
        }

        # pywebpush Vapid.from_string expects base64-encoded DER string (no PEM headers/footers)
        private_key = settings.VAPID_PRIVATE_KEY.strip()
        if private_key.startswith("-----BEGIN"):
            lines = private_key.splitlines()
            private_key = "".join([l.strip() for l in lines if l and not l.startswith("-----")])

        try:
            webpush(
                subscription_info=subscription_info,
                data=payload,
                vapid_private_key=private_key,
                vapid_claims={"sub": settings.VAPID_EMAIL}
            )
            logger.info(f"Successfully sent push notification to subscription {sub.id} of user {user_id}")
        except WebPushException as ex:
            logger.warning(f"WebPushException for subscription {sub.id} of user {user_id}: {ex}")
            # If the service endpoint returned 410 (Gone) or 404 (Not Found), subscription is invalid/expired
            if ex.response is not None and ex.response.status_code in [404, 410]:
                try:
                    db.delete(sub)
                    db.commit()
                    logger.info(f"Deleted expired/invalid push subscription {sub.id} of user {user_id}")
                except Exception as db_ex:
                    logger.error(f"Failed to delete expired subscription {sub.id}: {db_ex}")
                    db.rollback()
        except Exception as general_ex:
            logger.error(f"General exception sending push to subscription {sub.id}: {general_ex}")
