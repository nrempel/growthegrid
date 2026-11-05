SELECT blob6 AS via, blob1 AS step, SUM(_sample_interval) AS count
FROM growthegrid_events
WHERE timestamp > NOW() - INTERVAL '7' DAY AND timestamp > toDateTime('2026-11-04 22:20:00') AND blob1 IN ('lookup', 'send_click')
GROUP BY via, step
ORDER BY via, step
FORMAT JSON
