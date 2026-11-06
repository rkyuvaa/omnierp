from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://erp_user:password@localhost:5432/erp_db"
    SECRET_KEY: str = "changeme-secret-key"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    DISABLE_BIOMETRIC_SCHEDULER: bool = False

    VAPID_PUBLIC_KEY: str = ""
    VAPID_PRIVATE_KEY: str = ""
    VAPID_EMAIL: str = "mailto:rkyuvaa@gmail.com"

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()

