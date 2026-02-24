#!/bin/sh
PORT=${PORT:-3000}
echo "Starting nginx on port $PORT"
sed "s/__PORT__/${PORT}/g" /etc/nginx/nginx.conf.template > /etc/nginx/conf.d/default.conf
exec nginx -g "daemon off;"
