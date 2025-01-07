# gunicorn_config.py
workers = 2
threads = 4
timeout = 120
keepalive = 65
worker_class = 'gthread'
worker_connections = 1000
