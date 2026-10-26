# Weather App Refresh — Evidence (2026-10-26)

No key values anywhere in this file. Commands show appid=$OPENWEATHER_API_KEY.

## 0a Snapshots

.claude/snapshots/weather-refresh-0a-20261026T103153.tar.gz

## Commits

User authorized per-task commits on branch weather-app-refresh (explicit paths only), 2026-10-26.

## Environment (T0)

(pending)

## 0b OIDC spike

- 0b.1 | PASS | 2026-10-26 11:12 MDT | `AWS_PROFILE=fubo-tools kubectl --context vat-dev get ns training -o name` -> `namespace/training`
- Context ARN: `arn:aws:eks:us-east-1:650127479436:cluster/vat-development-blue`
- TRAINING_CLUSTER=vat-development-blue (NOT eks-staging-observability: `get ns training` there returns NotFound; kube context `smo-mgmt` (the default current context) returns a credentials error)
- Laptop recipe: `export AWS_PROFILE=fubo-tools; kubectl --context vat-dev ...` (aws sso session for profile fubo-tools, account 650127479436)

## 0c CRD Secret reference

- 0c.1 | PASS | 2026-10-26 11:12 MDT | `AWS_PROFILE=fubo-tools kubectl --context vat-dev explain application.spec --api-version=app.smo.tools.fubotv.net/v1alpha1 --recursive | grep -nE "env|valueFrom|secretKeyRef|envFrom|secretRef"`
```
12:  env	<[]Object>
15:    valueFrom	<Object>
32:      secretKeyRef	<Object>   (fields: key <string> -required-, name <string>, optional <boolean>)
```
- SECRET_REF_FIELD_PATH: `spec.env[].valueFrom.secretKeyRef`
- SECRET_REF_BLOCK (under `spec:`; `{{name}}-openweather` for the worked example, `__APP_NAME__-openweather` for the kit):
```yaml
  env:
    - name: OPENWEATHER_API_KEY
      valueFrom:
        secretKeyRef:
          name: {{name}}-openweather
          key: OPENWEATHER_API_KEY
```
- 0c.1 step 2 | INFO | 2026-10-26 11:12 MDT | `kubectl --context vat-dev get secrets -n training -o name | wc -l` -> 0 Secret names visible (names only recorded)
- Human gate (no Secret-reference field): NOT triggered, the CRD supports it.

## Stage 1 checks

(pending)

## Stage 1 known open issues

(pending)

## Stage 1 blocking fixes

(pending)

## Intake answer sheet

(pending)

## Stage 2 runs

(pending)

## Stage 2 artifacts

(pending)

## Stage 2 verification

(pending)

## Real route paths

(pending)

## Stage 3a checks

(pending)

## Stage 3b rehearsal

(pending)

## Stage 4 loop

(pending)

## Stage 5 refresher

(pending)

## Publishes

(pending)

## Final verification

(pending)

