# gunicorn_config.py
workers = 2
threads = 4
timeout = 120
keepalive = 65
worker_class = 'gthread'
<<<<<<< HEAD
worker_connections = 1000
=======
worker_connections = 1000
>>>>>>> e23b7750191fbbf619e373366dd6679b14d900d8
