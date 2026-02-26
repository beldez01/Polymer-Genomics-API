from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_db: str = "polymer_genomics"
    postgres_user: str = "api_reader"
    postgres_password: str = Field(
        default="api_reader_dev",
        validation_alias="POSTGRES_USER_PASSWORD",
    )

    s3_endpoint: str = "http://localhost:9000"
    s3_bucket: str = "polymer-genomics-api"
    s3_access_key: str = "minioadmin"
    s3_secret_key: str = "minioadmin"
    s3_region: str = "us-east-1"

    max_region_length: int = 10_000_000
    max_returned_rows: int = 50_000
    default_page_size: int = 1_000

    model_config = {"env_prefix": "", "env_file": ".env", "extra": "ignore"}


settings = Settings()
