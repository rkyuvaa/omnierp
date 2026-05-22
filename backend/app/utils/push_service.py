import json
import logging
from sqlalchemy.orm import Session
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
    Automatically removes expired/invalid subscriptions from the database.
    """
    if not db:
        logger.error("No DB session provided to send_push_to_user")
        return

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

        try:
            webpush(
                subscription_info=subscription_info,
                data=payload,
                vapid_private_key=settings.VAPID_PRIVATE_KEY,
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
