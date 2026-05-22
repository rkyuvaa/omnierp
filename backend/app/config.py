from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://erp_user:password@localhost:5432/erp_db"
    SECRET_KEY: str = "changeme-secret-key"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    DISABLE_BIOMETRIC_SCHEDULER: bool = False

    VAPID_PUBLIC_KEY: str = "BEHYGaYuo_Ye0vvnjvqldoHRx83a8Tn_300kiwcGsIvE9was0CbXkAooFJVMcf4FTg9UXEj6ww5ndEjje5F0X_U"
    VAPID_PRIVATE_KEY: str = """-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgDLpF3hVCR+bWv5bg
TuEraBQZFYCSxOaKwJ7d8eWivlGhRANCAARB2BmmLqP2HtL75476pXaB0cfN2vE5
/99NJIsHBrCLxPcGrNAm15AKKBSVTHH+BU4PVFxI+sMOZ3RI43uRdF/1
-----END PRIVATE KEY-----"""
    VAPID_EMAIL: str = "mailto:rkyuvaa@gmail.com"

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()

