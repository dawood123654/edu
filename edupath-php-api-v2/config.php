<?php
return [
  'db' => [
    'host' => getenv('DB_HOST') ?: '127.0.0.1',
    'port' => getenv('DB_PORT') ?: '3306',
    'name' => getenv('DB_NAME') ?: 'edupath',
    'user' => getenv('DB_USER') ?: 'root',
    'pass' => getenv('DB_PASS') ?: '',
    'charset' => 'utf8mb4',
  ],
  'jwt' => [
    'secret' => getenv('JWT_SECRET') ?: 'change-this-secret',
    'issuer' => 'edupath.api',
    'access_ttl' => 3600,
    'refresh_ttl' => 1209600,
  ]
];
