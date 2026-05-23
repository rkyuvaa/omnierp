import sys
import traceback
from app.config import settings
from pywebpush import webpush, WebPushException

print("Testing VAPID key loading and signing...")
print(f"VAPID private key length: {len(settings.VAPID_PRIVATE_KEY)}")

# Sanitize VAPID key just like push_service.py does
private_key = settings.VAPID_PRIVATE_KEY.strip()
if private_key.startswith("-----BEGIN"):
    lines = private_key.splitlines()
    private_key = "".join([l.strip() for l in lines if l and not l.startswith("-----")])

print(f"Sanitized key length: {len(private_key)}")

# Mock subscription
subscription_info = {
    "endpoint": "https://fcm.googleapis.com/fcm/send/mock-endpoint",
    "keys": {
        "p256dh": "BMT4O_mock_key_BMT4O_mock_key_BMT4O_mock_key",
        "auth": "mock_auth_key_mock"
    }
}

try:
    # This will trigger the VAPID signing logic
    webpush(
        subscription_info=subscription_info,
        data="test",
        vapid_private_key=private_key,
        vapid_claims={"sub": settings.VAPID_EMAIL}
    )
    print("Success! (Or got normal network error which means VAPID signing succeeded)")
except WebPushException as e:
    # A WebPushException (like 400/401/404) means the VAPID signature was generated successfully,
    # but the mock endpoint rejected the request. This is a SUCCESS for key loading/signing!
    print("VAPID signing succeeded! (Received expected WebPushException from mock endpoint)")
except Exception as e:
    print("\n--- ERROR DETECTED ---")
    print(f"Exception Type: {type(e).__name__}")
    print(f"Exception Message: {e}")
    print("\nFull Traceback:")
    traceback.print_exc()
    sys.exit(1)
