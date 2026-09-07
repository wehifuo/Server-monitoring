import time
from database import SessionLocal, Base, engine
import models
import requests

Base.metadata.create_all(bind=engine)

TARGET_SERVICES = [
    {"name": "ЕИС Реестры", "url": "https://httpbin.org/status/200"},
    {"name": "МЭВ Веб-сервис", "url": "https://httpbin.org/delay/1"},
    {"name": "Шина данных", "url": "https://httpbin.org/status/500"},
]


def check_and_save_services():
    db = SessionLocal()
    try:
        for service in TARGET_SERVICES:
            start_time = time.time()
            status_code = None
            is_available = 0

            try:
                response = requests.get(service["url"], timeout=3.0)
                status_code = response.status_code
                response_time = (time.time() - start_time) * 1000

                if response.status_code == 200:
                    is_available = 1
            except requests.exceptions.RequestException:
                response_time = (time.time() - start_time) * 1000

            metric = models.ServerMetric(
                service_name=service["name"],
                service_url=service["url"],
                status_code=status_code,
                response_time_ms=round(response_time, 2),
                is_available=is_available,
            )
            db.add(metric)

        db.commit()
        print(" Успешно сохранен замер метрик в БД!")

    except Exception as e:
        print(f"Ошибка при работе с БД: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    print("0000000000000000000000000")
    while True:
        check_and_save_services()
        time.sleep(20)  







