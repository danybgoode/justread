#!/usr/bin/env bash
# Host-side setup, run once on the VM after .env is in place:
#   sudo /opt/panfleto/deploy/install-host.sh
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

[ -f .env ] || { echo "deploy/.env is missing - copy .env.example and fill it in" >&2; exit 1; }
chmod 600 .env
[ -f oauth.env ] && chmod 600 oauth.env

install -m 0644 panfleto-backup.service /etc/systemd/system/
install -m 0644 panfleto-backup.timer   /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now panfleto-backup.timer

echo "backup timer installed:"
systemctl list-timers panfleto-backup.timer --no-pager
