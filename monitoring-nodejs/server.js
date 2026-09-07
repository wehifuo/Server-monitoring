const express = require('express');
const path = require('path');
const pool = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------------- REST API ----------------

// 1. Прием метрик от Python (POST /api/metrics)
app.post('/api/metrics', async (req, res) => {
  const { service_name, service_url, status_code, response_time_ms, is_available } = req.body;

  if (!service_name || !service_url) {
    return res.status(400).json({ error: 'Переданы неполные данные' });
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
    res.status(201).json({ status: 'success', id: result.rows[0].id });
  } catch (err) {
    console.error('Ошибка при сохранении в PostgreSQL:', err.message);
    res.status(500).json({ error: 'Ошибка сервера при сохранении метрики' });
  }
});

// 2. Выдача данных и логов для фронтенда (GET /api/metrics)
app.get('/api/metrics', async (req, res) => {
  try {
    // Получаем уникальные сервисы
    const servicesResult = await pool.query(
      'SELECT DISTINCT service_name FROM server_logs'
    );
    const serviceNames = servicesResult.rows.map((r) => r.service_name);

    const servicesData = [];

    for (const name of serviceNames) {
      // Берём последние 20 замеров для построения графика
      const metricsResult = await pool.query(
        `SELECT * FROM server_logs 
         WHERE service_name = $1 
         ORDER BY created_at DESC LIMIT 20`,
        [name]
      );

      const metrics = metricsResult.rows.reverse(); // Сортировка от старых к новым
      if (metrics.length === 0) continue;

      const totalChecks = metrics.length;
      const successfulChecks = metrics.filter((m) => m.is_available === 1).length;

      servicesData.push({
        name,
        url: metrics[metrics.length - 1].service_url,
        current_status: metrics[metrics.length - 1].is_available,
        uptime: ((successfulChecks / totalChecks) * 100).toFixed(1),
        avg_latency: (
          metrics.reduce((acc, m) => acc + m.response_time_ms, 0) / totalChecks
        ).toFixed(1),
        labels: metrics.map((m) =>
          new Date(m.created_at).toLocaleTimeString('ru-RU')
        ),
        latencies: metrics.map((m) => m.response_time_ms),
      });
    }

    // Получаем последние 30 записей для системных логов
    const logsResult = await pool.query(
      `SELECT service_name, status_code, response_time_ms, is_available, created_at 
       FROM server_logs ORDER BY created_at DESC LIMIT 1000`
    );

    res.json({
      services: servicesData,
      logs: logsResult.rows,
    });
  } catch (err) {
    console.error('Ошибка при чтении из PostgreSQL:', err.message);
    res.status(500).json({ error: 'Ошибка сервера при получении данных' });
  }
});

app.listen(PORT, () => {
  console.log(` Node.js сервер запущен на http://localhost:${PORT}`);
});
