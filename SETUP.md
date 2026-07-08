# Setup Guide — Inventory Manager GitOps Pipeline

This document is the complete, ordered setup path for this project: from a bare Linux machine to a 3-node k3s cluster running the Inventory Manager under ArgoCD with TLS and monitoring. Follow it top to bottom for a first-time install; each section states what it does, the exact commands, and the quirks that will bite you if skipped.

Day-2 operations (checking pods, certs, ArgoCD status, Grafana) and the full lessons-learned write-ups live in [NOTES.md](NOTES.md).

---

## 1. Overview

There are two ways to run this project:

| Mode | What you get | Time |
| --- | --- | --- |
| **Local development** (section 2) | Full stack in Docker Compose on your machine | ~5 min |
| **Cluster deployment** (sections 3–8) | 3 KVM VMs, k3s, ArgoCD GitOps, TLS, Prometheus/Grafana | ~1–2 h first time |

The cluster deployment order matters: **Terraform → Ansible → DuckDNS bootstrap → ArgoCD takes over**. Everything after the Ansible step is pulled from git by ArgoCD — you never `kubectl apply` application manifests by hand.

---

## 2. Local Development (Docker Compose)

Prerequisites: Docker and Docker Compose.

```bash
git clone https://github.com/ToYoNiX/gitops-terraform-kubernates.git
cd gitops-terraform-kubernates
docker compose up --build
```

| Service | URL |
| --- | --- |
| Frontend | <http://localhost> |
| Backend API | <http://localhost:8080> |
| Swagger UI | <http://localhost:8080/swagger-ui.html> |
| Prometheus | <http://localhost:9090> |
| Grafana | <http://localhost:3000> |

Default app login: `admin` / `admin`. Postgres is at `localhost:5432` (db `inventory`, user `postgres`, pass `postgres`).

> **Quirk:** the compose file uses `grafana/grafana:latest`. A fresh pull may fetch Grafana 11+, where the legacy Angular panels in the JVM dashboard stop rendering. If the dashboard breaks locally, pin the image to `grafana/grafana:10.4.1` to match the cluster.

---

## 3. Cluster Prerequisites (host machine, once)

### 3.1 Hardware

The Terraform config creates 3 VMs, each 2 vCPU / 4 GB RAM / 15 GB disk. The host therefore needs at least **6 spare vCPUs, 12 GB spare RAM, and ~50 GB disk** (VM disks + the ~600 MB Ubuntu cloud image), plus hardware virtualization enabled in BIOS (`kvm-ok` to check).

### 3.2 Install packages

```bash
sudo apt install -y qemu-kvm libvirt-daemon-system virtinst terraform ansible genisoimage xsltproc
```

> **Quirk — `genisoimage` is not optional:** it provides `mkisofs`, which the libvirt Terraform provider uses to build the cloud-init ISOs. Without it, `terraform apply` fails *after* downloading the 600 MB base image with `exec: "mkisofs": executable file not found in $PATH`.
>
> **Quirk — `xsltproc`:** required because the VM definition applies an XSLT transform to set the CPU topology.

### 3.3 Libvirt group membership

```bash
sudo usermod -aG libvirt $USER
newgrp libvirt        # or log out/in
```

### 3.4 Disable AppArmor confinement for QEMU

On Ubuntu, QEMU runs as `libvirt-qemu` and AppArmor blocks it from reading disk images downloaded by your user. Without this, VMs get *defined* but fail to *start* with `Permission denied` on the disk image:

```bash
sudo sed -i 's/#security_driver = "selinux"/security_driver = "none"/' /etc/libvirt/qemu.conf
sudo systemctl restart libvirtd
```

### 3.5 Generate the SSH keypair

```bash
ssh-keygen -t ed25519 -C "depi-k3s" -f ~/.ssh/depi_k3s -N ""
```

- `-N ""` — no passphrase; Ansible needs passwordless SSH
- The **private** key (`~/.ssh/depi_k3s`) must never be committed; the `.pub` is what Terraform injects into the VMs
- The Ansible config (`ansible/ansible.cfg`) already points at this exact path, so keep the name

---

## 4. Provision the VMs with Terraform

### 4.1 Run

```bash
cd terraform
terraform init                                              # downloads the libvirt provider (once)
terraform validate                                          # syntax check, touches nothing
terraform plan  -var="ssh_public_key_path=~/.ssh/depi_k3s.pub"   # dry run
terraform apply -var="ssh_public_key_path=~/.ssh/depi_k3s.pub"
```

### 4.2 What it creates

| Resource | Detail |
| --- | --- |
| NAT network `k3s-network` | `10.17.3.0/24`, gateway `10.17.3.1`, domain `k3s.local` |
| `k3s-master` | `10.17.3.10` — control plane |
| `k3s-agent-1` | `10.17.3.11` |
| `k3s-agent-2` | `10.17.3.12` |
| Base volume | Ubuntu 22.04 cloud image, downloaded once, thin-cloned per VM |
| Cloud-init ISOs | Inject hostname, the `depi` user + your SSH key, static IP |

First boot runs cloud-init (~60–90 s) before SSH is ready.

### 4.3 Quirks already handled in the config (don't "fix" them)

- **Static IPs are assigned by MAC-address matching**, not interface names. Ubuntu cloud images name the NIC unpredictably (`ens3`, `enp1s0`, …); hardcoding a name makes the static IP silently never apply. Fixed MACs are defined in `variables.tf` locals and matched in `cloud-init/network-config.yaml.tpl`.
- **CPU topology is injected via XSLT** because the provider's `cpu` block can't express sockets/cores/threads.

### 4.4 Verify

```bash
terraform output                     # prints IPs and ready-made ssh commands
virsh list --all                     # all 3 VMs "running"
ssh -i ~/.ssh/depi_k3s depi@10.17.3.10 "hostname && ip -4 a show scope global"
```

If SSH times out, give cloud-init another minute; if a VM is "shut off" with a disk permission error, revisit section 3.4.

---

## 5. Install k3s + ArgoCD with Ansible

### 5.1 Pre-check

The static inventory (`ansible/inventory/hosts.ini`) matches the Terraform IPs — nothing to edit unless you changed the network. Confirm connectivity:

```bash
cd ansible
ansible k3s -m ping
```

### 5.2 Run

```bash
ansible-playbook playbooks/site.yml
```

(Use `playbooks/k3s.yml` instead for cluster-only, no ArgoCD — useful for testing.)

### 5.3 What each phase does

1. **common** (all nodes) — apt packages, disable swap, load `br_netfilter`/`overlay`, k8s sysctls, hostnames
2. **k3s-server** (master) — installs k3s `v1.29.4+k3s1` with `--disable=traefik` (ingress-nginx comes via ArgoCD instead), waits for Ready, **fetches the kubeconfig to your local `~/.kube/config`** with the server rewritten to `10.17.3.10`
3. **k3s-agent** (agents) — joins both agents using the master's node token
4. **argocd** (master) — installs ArgoCD via Helm (chart `5.51.6`) on NodePort `30080`, prints the admin password, and registers the **root Application** pointing at `k8s/apps` on `main`

> **Quirk — idempotency limit:** the k3s install tasks are guarded by "is the k3s binary present". Re-running the playbook won't re-apply changed k3s flags on an existing node; to change install flags, uninstall k3s on the node (or rebuild the VMs) first.
>
> **Quirk — kubeconfig overwrite:** the fetch step writes to `~/.kube/config` on your machine, replacing whatever is there. Back yours up if you use other clusters.

### 5.4 Verify

```bash
ssh -i ~/.ssh/depi_k3s depi@10.17.3.10 "sudo k3s kubectl get nodes -o wide"      # 3 nodes Ready
ssh -i ~/.ssh/depi_k3s depi@10.17.3.10 "sudo k3s kubectl get applications -n argocd"
```

---

## 6. DuckDNS + TLS Bootstrap

### 6.1 Register the subdomains

At [duckdns.org](https://www.duckdns.org), register **three** subdomains and point all of them at the ingress IP `10.17.3.10`:

| Subdomain | Serves |
| --- | --- |
| `prod-devops-depi` | Production app |
| `dev-devops-depi` | Dev app |
| `monitoring-devops-depi` | Grafana |

DNS resolves publicly, but the IP is LAN-scoped — this works for any machine on the same local network without port forwarding.

### 6.2 Create the token secret (the one manual cluster step)

The DuckDNS token (shown at the top of the DuckDNS page after login) is used by cert-manager for the DNS-01 challenge and must **never be committed to git**. Create it before cert-manager tries to issue:

```bash
kubectl create secret generic duckdns-token \
  --from-literal=token=<your-duckdns-token> \
  --namespace cert-manager
```

(If the `cert-manager` namespace doesn't exist yet, wait a minute for ArgoCD to create it, or create the namespace yourself.)

### 6.3 Quirk — networks that filter DNS TXT queries

Some ISPs silently drop **DNS TXT queries on port 53** (ours does). This breaks cert-manager's DNS-01 propagation self-check with `dial tcp <ip>:53: i/o timeout` even though the DuckDNS webhook publishes the record correctly. The repo already ships the fix (a `coredns-custom` ConfigMap forwarding `duckdns.org` over DNS-over-TLS + cert-manager `--dns01-recursive-nameservers` flags) — see the full story in [NOTES.md](NOTES.md). If certificates hang in `pending`, that section is the first place to look.

### 6.4 Verify issuance

Certificates typically issue within a few minutes of the token secret existing:

```bash
ssh -i ~/.ssh/depi_k3s depi@10.17.3.10 "sudo k3s kubectl get certificate,challenge -A"
echo | openssl s_client -connect 10.17.3.10:443 -servername prod-devops-depi.duckdns.org 2>/dev/null | openssl x509 -noout -issuer -enddate
```

Expect issuer `O = Let's Encrypt`. Stuck challenges can be nudged: `ssh -i ~/.ssh/depi_k3s depi@10.17.3.10 "sudo k3s kubectl delete challenge -n cert-manager --all"` — cert-manager recreates them immediately.

---

## 7. ArgoCD Takes Over

Nothing to run — once the root app is registered, ArgoCD deploys everything with auto-sync + prune + self-heal:

| Application | Source | Branch |
| --- | --- | --- |
| `ingress-nginx` | upstream Helm chart 4.10.1 | — |
| `cert-manager` | upstream Helm chart v1.14.5 | — |
| `cert-manager-extras` | `k8s/cert-manager` | `main` |
| `duckdns-webhook` | `k8s/duckdns-webhook` | `main` |
| `inventory-prod` | `k8s/overlays/prod` | `main` |
| `inventory-dev` | `k8s/overlays/dev` | `dev` |
| `monitoring` | kube-prometheus-stack 58.7.2 | — |
| `monitoring-extras` | `k8s/monitoring-extras` | `main` |

> **Branch rule to remember:** only `k8s/overlays/dev` is driven by the `dev` branch. The ArgoCD app definitions and all shared infra paths only take effect once merged to **`main`**.

ArgoCD UI: `http://10.17.3.10:30080`, user `admin`, password:

```bash
ssh -i ~/.ssh/depi_k3s depi@10.17.3.10 "sudo k3s kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d; echo"
```

ArgoCD polls git every ~3 minutes; to force an immediate refresh of an app:

```bash
ssh -i ~/.ssh/depi_k3s depi@10.17.3.10 "sudo k3s kubectl -n argocd annotate application inventory-prod argocd.argoproj.io/refresh=hard --overwrite"
```

---

## 8. Access the Deployed Services

| Service | URL | Credentials |
| --- | --- | --- |
| Production app | <https://prod-devops-depi.duckdns.org> | admin / admin |
| Dev app | <https://dev-devops-depi.duckdns.org> | admin / admin |
| Grafana | <https://monitoring-devops-depi.duckdns.org> | admin / admin |
| ArgoCD UI | <http://10.17.3.10:30080> | admin / (section 7) |

The JVM (Micrometer) dashboard is at `/d/jvm-micrometer/` in Grafana; use the **Application** dropdown (`inventory-backend`) and the **Instance** dropdown to switch between prod and dev pods.

If ingress/DNS is unavailable, the port-forward one-liners are in [NOTES.md](NOTES.md).

---

## 9. CI/CD Setup (GitHub Side)

Needed once per fork/repo for the pipelines to go green:

1. **Actions secrets** — `SONAR_TOKEN`, `SONAR_HOST_URL`, `SONAR_ORGANIZATION`, optionally `NVD_API_KEY` and `GITLEAKS_LICENSE`. Step-by-step acquisition instructions are in [MEMORY.md](MEMORY.md) under *GitHub Actions secrets*.
2. **SonarCloud** — import the repo and **disable Automatic Analysis** (Administration → Analysis Method), or the CI scan fails. The `sonar.projectKey` in `backend/pom.xml` / `frontend/sonar-project.properties` must match SonarCloud's auto-generated `{org}_{repo}` key.
3. **GHCR** — no secret needed (workflows use `GITHUB_TOKEN`), but note the quirk: **image names must be lowercase**. The workflows already lowercase `github.repository_owner` in a shell step; keep that if you touch them.
4. **If you forked**: update `repoURL` in every `k8s/apps/*.yml`, `ansible/inventory/group_vars/all.yml` (`argocd_repo_url`), and the image names in `k8s/base` + overlays to your GHCR path.

---

## 10. Teardown

```bash
cd terraform
terraform destroy -var="ssh_public_key_path=~/.ssh/depi_k3s.pub"
```

Destroys the VMs, their disks, the cloud-init ISOs, and the NAT network. The downloaded base image volume is also managed by Terraform and gets removed; the next `apply` re-downloads it. Your local `~/.kube/config` will still point at the dead cluster — restore your backup or delete it.

---

## 11. Troubleshooting Index

Symptoms → where to look (all in [NOTES.md](NOTES.md)):

| Symptom | NOTES.md section |
| --- | --- |
| `terraform apply` fails with `mkisofs not found` | Terraform walkthrough (install `genisoimage`) |
| VMs defined but won't start (`Permission denied`) | Terraform walkthrough (AppArmor) |
| VM boots with no/wrong IP | Terraform walkthrough (MAC matching) |
| Certificates stuck `pending`, challenges time out | *TLS Certificates Stuck Pending — ISP Drops DNS TXT Queries* |
| Grafana dashboard shows N/A everywhere | *Grafana JVM Dashboard Empty — ServiceMonitor Matches Service Labels* |
| Grafana nags "unsaved changes" on a provisioned dashboard | Same section — schema re-export + uid gotcha |
| CI fails with `repository name must be lowercase` | *GitHub Actions / GHCR Gotchas* |
| Gitleaks keeps flagging an already-removed secret | *GitHub Actions / GHCR Gotchas* |
| Day-2 ops (pods, logs, certs, restarts) | *Cluster Operations — Useful Commands* (copy-paste ssh one-liners) |
