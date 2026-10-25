import logging
import os
import signal
import threading
import time

import requests

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(message)s",
)

NODE_API_URL = os.getenv("NODE_API_URL", "http://localhost:3000/api/metrics")
POLL_INTERVAL_SECONDS = float(os.getenv("POLL_INTERVAL_SECONDS", "10"))
REQUEST_TIMEOUT_SECONDS = float(os.getenv("REQUEST_TIMEOUT_SECONDS", "3"))

TARGET_SERVICES = [
    {"name": "server1", "url": "https://httpbin.org/status/200"},
    {"name": "server2", "url": "https://httpbin.org/delay/1"},
    {"name": "server3", "url": "https://httpbin.org/status/500"},
]

stop_event = threading.Event()


def handle_shutdown(signum, _frame):
    logging.info("Получен сигнал %s, завершаем работу...", signum)
    stop_event.set()


def check_and_send_metrics():
    for service in TARGET_SERVICES:
        start_time = time.time()
        status_code = None
        is_available = 0

        try:
            response = requests.get(
                service["url"], timeout=REQUEST_TIMEOUT_SECONDS
            )
            status_code = response.status_code
            if status_code == 200:
                is_available = 1
        except requests.exceptions.RequestException as exc:
            logging.warning("Сервис '%s' недоступен: %s", service["name"], exc)

        response_time = (time.time() - start_time) * 1000

        payload = {
            "service_name": service["name"],
            "service_url": service["url"],
            "status_code": status_code,
            "response_time_ms": round(response_time, 2),
            "is_available": is_available,
        }
        logging.info("Метрика %s: %s", service["name"], payload)

        try:
            res = requests.post(NODE_API_URL, json=payload, timeout=2.0)
            if res.status_code == 201:
                logging.info("'%s' отправлено в Node.js", service["name"])
            else:
                logging.warning(
                    "Node.js вернул код %s для '%s'", res.status_code, service["name"]
                )
        except requests.exceptions.RequestException as exc:
            logging.error("Не удалось отправить метрику в Node.js на %s: %s", NODE_API_URL, exc)


if __name__ == "__main__":
    signal.signal(signal.SIGTERM, handle_shutdown)
    signal.signal(signal.SIGINT, handle_shutdown)

    logging.info(
        "Python Worker запущен. Опрос сервисов каждые %s секунд...",
        POLL_INTERVAL_SECONDS,
    )
    while not stop_event.is_set():
        check_and_send_metrics()
        stop_event.wait(POLL_INTERVAL_SECONDS)
