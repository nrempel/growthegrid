SELECT blob1 AS step, blob2 AS detail, SUM(_sample_interval) AS count
FROM growthegrid_events
WHERE timestamp > NOW() - INTERVAL '7' DAY AND timestamp > toDateTime('2026-11-04 22:20:00')
GROUP BY step, detail
ORDER BY step, count DESC
FORMAT JSON
