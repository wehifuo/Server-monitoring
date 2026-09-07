from datetime import datetime
from sqlalchemy import Column, DateTime, Float, Integer, String
from database import Base


class ServerMetric(Base):
    __tablename__ = "logs"

    id = Column(Integer, primary_key=True, index=True)
    service_name = Column(String(100), nullable=False, index=True)
    service_url = Column(String(255), nullable=False)
    status_code = Column(Integer, nullable=True)
    response_time_ms = Column(Float, nullable=False)
    is_available = Column(Integer, nullable=False)
    created_at = Column(
        DateTime, default=datetime.now, nullable=False, index=True
    )
