FROM apache/airflow:3.3.0-python3.12

COPY --chmod=0755 docker-entrypoint.sh /opt/airflow/railway-entrypoint.sh

ENTRYPOINT ["/opt/airflow/railway-entrypoint.sh"]
