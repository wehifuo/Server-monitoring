const express = require("express");
const path = require("path");
const pool = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;

app.disable("x-powered-by");
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Liveness: процесс жив и отвечает
app.get("/healthz", (req, res) => {
  res.json({ status: "ok" });
});

// Readiness: процесс готов принимать трафик (БД доступна)
app.get("/readyz", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ready" });
  } catch (err) {
    res.status(503).json({ status: "unavailable", error: err.message });
  }
});

app.post("/api/metrics", async (req, res) => {
  const {
    service_name,
    service_url,
    status_code,
    response_time_ms,
    is_available,
  } = req.body;

  if (!service_name || !service_url) {
    return res.status(400).json({ error: "Переданы неполные данные" });
  }

  const queryText = `
    INSERT INTO server_logs (service_name, service_url, status_code, response_time_ms, is_available)
    VALUES ($1, $2, $3, $4, $5) RETURNING id;
  `;

  try {
    const result = await pool.query(queryText, [
      service_name,
      service_url,
      status_code,
      response_time_ms,
      is_available,
    ]);
    res.status(201).json({ status: "success", id: result.rows[0].id });
  } catch (err) {
    console.error("Ошибка при сохранении в PostgreSQL:", err.message);
    res.status(500).json({ error: "Ошибка сервера при сохранении метрики" });
  }
});

app.get("/api/metrics", async (req, res) => {
  try {
    const metricsResult = await pool.query(
      `SELECT *
       FROM (
         SELECT *,
                ROW_NUMBER() OVER (
                  PARTITION BY service_name ORDER BY created_at DESC
                ) AS rn
         FROM server_logs
       ) ranked
       WHERE rn <= 100
       ORDER BY service_name, created_at`,
    );

    const metricsByService = new Map();
    for (const row of metricsResult.rows) {
      if (!metricsByService.has(row.service_name)) {
        metricsByService.set(row.service_name, []);
      }
      metricsByService.get(row.service_name).push(row);
    }

    const servicesData = [];

    for (const [name, metrics] of metricsByService) {
      const totalChecks = metrics.length;
      const successfulChecks = metrics.filter(
        (m) => m.is_available === 1,
      ).length;
      const latest = metrics[metrics.length - 1];

      servicesData.push({
        name,
        url: latest.service_url,
        current_status: latest.is_available,
        uptime: ((successfulChecks / totalChecks) * 100).toFixed(1),
        avg_latency: (
          metrics.reduce((acc, m) => acc + m.response_time_ms, 0) / totalChecks
        ).toFixed(1),
        labels: metrics.map((m) =>
          new Date(m.created_at).toLocaleTimeString("ru-RU"),
        ),
        latencies: metrics.map((m) => m.response_time_ms),
      });
    }

    const logsResult = await pool.query(
      `SELECT service_name, status_code, response_time_ms, is_available, created_at 
       FROM server_logs ORDER BY created_at DESC LIMIT 100`,
    );

    res.json({
      services: servicesData,
      logs: logsResult.rows,
    });
  } catch (err) {
    console.error("Ошибка при чтении из PostgreSQL:", err.message);
    res.status(500).json({ error: "Ошибка сервера при получении данных" });
  }
});

const server = app.listen(PORT, () => {
  console.log(`Node.js сервер запущен на http://localhost:${PORT}`);
});

const shutdown = (signal) => {
  console.log(`Получен ${signal}, останавливаем сервер...`);

  server.close(async () => {
    try {
      await pool.end();
    } finally {
      process.exit(0);
    }
  });

  setTimeout(() => process.exit(1), 10000).unref();
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
