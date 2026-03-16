---
name: incident-triage
description: Use for production incident triage — structured evidence collection and root cause analysis.
---

## Triage Steps

1. **Assess severity**: Is the service down? Degraded? Affecting users?
2. **Collect evidence**: Logs, metrics, recent deployments, config changes
3. **Identify scope**: Which components/services are affected?
4. **Root cause analysis**: Narrow down from symptoms to cause
5. **Propose fix**: Immediate mitigation + long-term fix

## Evidence Checklist

- [ ] Application logs from affected time window
- [ ] Recent deployment history
- [ ] Configuration changes
- [ ] Dependency status (database, external APIs)
- [ ] Error rates and latency metrics

## Output

- **Severity**: P0/P1/P2/P3
- **Impact**: What users/features are affected
- **Root cause**: Identified or suspected
- **Mitigation**: Immediate steps to restore service
- **Follow-up**: Long-term fix and prevention
