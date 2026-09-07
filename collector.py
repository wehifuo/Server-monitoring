import time
import requests

NODE_API_URL = "http://localhost:3000/api/metrics"

TARGET_SERVICES = [
    {"name": "server1", "url": "https://httpbin.org/status/200"},
    {"name": "server2", "url": "https://httpbin.org/delay/1"},
    {"name": "server3", "url": "https://httpbin.org/status/500"},
]


def check_and_send_metrics():
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

        payload = {
            "service_name": service["name"],
            "service_url": service["url"],
            "status_code": status_code,
            "response_time_ms": round(response_time, 2),
            "is_available": is_available,
        }
        print(payload)
        try:
            res = requests.post(NODE_API_URL, json=payload, timeout=2.0)
            if res.status_code == 201:
                print(f"'{service['name']}' отправлено в Node.js")
            else:
                print(f"Node.js вернул код {res.status_code} для '{service['name']}'")
        except requests.exceptions.ConnectionError:
            print(f"Не удалось подключиться к Node.js на {NODE_API_URL}.")


if __name__ == "__main__":
    print("Python Worker запущен. Опрос сервисов каждые 10 секунд...")
    while True:
        check_and_send_metrics()
        time.sleep(10)  
