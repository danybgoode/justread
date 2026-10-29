#!/usr/bin/env bash
# Host-side setup, run once on the VM after .env is in place:
#   sudo /opt/panfleto/deploy/install-host.sh
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

[ -f .env ] || { echo "deploy/.env is missing - copy .env.example and fill it in" >&2; exit 1; }
chmod 600 .env
[ -f oauth.env ] && chmod 600 oauth.env

install -m 0644 panfleto-backup.service panfleto-backup.timer \
  panfleto-restore-drill.service panfleto-restore-drill.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now panfleto-backup.timer panfleto-restore-drill.timer

echo "backup and restore-drill timers installed:"
systemctl list-timers 'panfleto-*' --no-pager
