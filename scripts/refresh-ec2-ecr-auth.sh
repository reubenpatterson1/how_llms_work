#!/usr/bin/env bash
#
# Refresh ECR docker login on the architect EC2 host using THIS machine's
# AWS SSO credentials. Run from your laptop. Works as long as your local
# `aws sts get-caller-identity` is valid (SSO session not expired).
#
# Usage:   ./scripts/refresh-ec2-ecr-auth.sh
# Cron (your laptop, every 6h):
#   0 */6 * * * /Users/<you>/LLM_Presentation/scripts/refresh-ec2-ecr-auth.sh >> /tmp/ec2-ecr-refresh.log 2>&1
#
# If your SSO session has expired, this will fail loudly. Run `aws sso login`
# and retry.

set -euo pipefail

REGION="${REGION:-us-east-1}"
REGISTRY="${REGISTRY:-650127479436.dkr.ecr.${REGION}.amazonaws.com}"
EC2_HOST="${EC2_HOST:-ec2-user@ec2-52-91-187-71.compute-1.amazonaws.com}"
SSH_KEY="${SSH_KEY:-$HOME/key.pem}"

echo "[$(date)] refreshing ECR auth on ${EC2_HOST}"

# Get a fresh token from local AWS creds
TOKEN=$(aws ecr get-login-password --region "${REGION}")
if [[ -z "${TOKEN}" ]]; then
  echo "ERROR: aws ecr get-login-password returned empty. Is your SSO session active?" >&2
  echo "Run: aws sso login" >&2
  exit 1
fi

# Pipe token to EC2's docker login (NEVER print the token)
ssh -i "${SSH_KEY}" -o ConnectTimeout=10 "${EC2_HOST}" \
  "docker login --username AWS --password-stdin ${REGISTRY}" <<<"${TOKEN}" \
  | grep -v "WARNING" \
  | grep -v "openssh.com" \
  | tail -3

echo "[$(date)] done"
