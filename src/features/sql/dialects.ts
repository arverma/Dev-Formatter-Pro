export interface SqlDialect {
  /** Human-readable label for the UI dropdown */
  label: string;
  /** sql-formatter language identifier */
  value: string;
}

// Source: sql-formatter v15 official docs + CLI --language flag list
export const SQL_DIALECTS: SqlDialect[] = [
  { label: 'Trino / Presto', value: 'trino' },         // ⭐ default
  { label: 'Standard SQL', value: 'sql' },
  { label: 'PostgreSQL', value: 'postgresql' },
  { label: 'MySQL', value: 'mysql' },
  { label: 'MariaDB', value: 'mariadb' },
  { label: 'BigQuery', value: 'bigquery' },
  { label: 'Snowflake', value: 'snowflake' },
  { label: 'Spark SQL', value: 'spark' },
  { label: 'Apache Hive', value: 'hive' },
  { label: 'SQL Server / T-SQL', value: 'transactsql' },
  { label: 'Oracle PL/SQL', value: 'plsql' },
  { label: 'Amazon Redshift', value: 'redshift' },
  { label: 'IBM DB2', value: 'db2' },
  { label: 'IBM DB2i', value: 'db2i' },
  { label: 'SQLite', value: 'sqlite' },
  { label: 'ClickHouse', value: 'clickhouse' },
  { label: 'TiDB', value: 'tidb' },
  { label: 'SingleStoreDB', value: 'singlestoredb' },
  { label: 'Couchbase N1QL', value: 'n1ql' },
];

export const DEFAULT_SQL_DIALECT = 'trino';
