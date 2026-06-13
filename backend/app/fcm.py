"""
FCM Push Notification sender for KIM-Connect mobile app.
Uses Firebase Admin SDK to deliver real-time notifications to Android devices.

Setup:
  1. Download service account JSON from Firebase Console
     (Project Settings → Service Accounts → Generate new private key)
  2. Save it as: backend/firebase-service-account.json
  3. Run: pip install firebase-admin
"""

import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)

# Lazy initialisation — only loads Firebase if the service account file exists
_firebase_app = None
_firebase_available = False


def _init_firebase():
    global _firebase_app, _firebase_available
    if _firebase_app is not None:
        return _firebase_available

    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    sa_path = os.path.join(backend_dir, "firebase-service-account.json")

    if not os.path.exists(sa_path):
        import glob
        matches = glob.glob(os.path.join(backend_dir, "*firebase-adminsdk*.json"))
        if matches:
            sa_path = matches[0]
            logger.info("Found Firebase credential match: %s", os.path.basename(sa_path))
        else:
            logger.warning(
                "⚠️  Firebase credentials file (*firebase-adminsdk*.json) not found in %s — "
                "FCM push notifications will be disabled.",
                backend_dir
            )
            _firebase_available = False
            return False

    try:
        import firebase_admin
        from firebase_admin import credentials
        cred = credentials.Certificate(sa_path)
        _firebase_app = firebase_admin.initialize_app(cred)
        _firebase_available = True
        logger.info("✅ Firebase Admin SDK initialised — FCM push notifications ENABLED")
    except Exception as e:
        logger.error("❌ Failed to initialise Firebase Admin SDK: %s", e)
        _firebase_available = False

    return _firebase_available


def send_fcm_push(
    device_token: str,
    title: str,
    body: str,
    data: Optional[dict] = None
) -> bool:
    """
    Send a single FCM push notification to a device token.
    Returns True on success, False on failure.
    """
    if not _init_firebase():
        return False

    try:
        from firebase_admin import messaging
        message = messaging.Message(
            notification=messaging.Notification(title=title, body=body),
            data={k: str(v) for k, v in (data or {}).items()},
            android=messaging.AndroidConfig(
                priority="high",
                notification=messaging.AndroidNotification(
                    sound="default",
                    default_sound=True,
                ),
            ),
            token=device_token,
        )
        response = messaging.send(message)
        logger.debug("FCM sent to %s… response: %s", device_token[-8:], response)
        return True
    except Exception as e:
        logger.warning("FCM send failed for token %s…: %s", device_token[-8:], e)
        return False


def send_fcm_multicast(
    device_tokens: list,
    title: str,
    body: str,
    data: Optional[dict] = None
) -> dict:
    """
    Send FCM to multiple device tokens at once (batch, max 500 per call).
    Returns { "success": N, "failure": M }
    """
    if not _init_firebase() or not device_tokens:
        return {"success": 0, "failure": len(device_tokens)}

    try:
        from firebase_admin import messaging
        message = messaging.MulticastMessage(
            notification=messaging.Notification(title=title, body=body),
            data={k: str(v) for k, v in (data or {}).items()},
            android=messaging.AndroidConfig(
                priority="high",
                notification=messaging.AndroidNotification(
                    sound="default",
                    default_sound=True,
                ),
            ),
            tokens=device_tokens[:500],  # FCM hard limit
        )
        response = messaging.send_each_for_multicast(message)
        return {
            "success": response.success_count,
            "failure": response.failure_count,
        }
    except Exception as e:
        logger.error("FCM multicast failed: %s", e)
        return {"success": 0, "failure": len(device_tokens)}


# Initialise eagerly at import time (non-blocking, just checks file)
_init_firebase()


def send_push_notification(
    user_id: int,
    title: str,
    body: str
) -> bool:
    """
    Reads the user's fcm_token from DB and sends FCM notification.
    """
    from app.database import SessionLocal
    from app.models import User

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user or not user.fcm_token:
            logger.warning("No FCM token found for user %s", user_id)
            return False
        
        return send_fcm_push(user.fcm_token, title, body)
    except Exception as e:
        logger.error("Failed to send push notification to user %s: %s", user_id, e)
        return False
    finally:
        db.close()

