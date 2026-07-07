#cloud-config
hostname: ${hostname}
fqdn: ${hostname}.k3s.local
manage_etc_hosts: true

users:
  - name: ${vm_user}
    sudo: ALL=(ALL) NOPASSWD:ALL
    shell: /bin/bash
    groups: [sudo]
    ssh_authorized_keys:
      - ${ssh_public_key}

# Disable root SSH login
disable_root: true

package_update: true
package_upgrade: false

packages:
  - curl
  - wget
  - git
  - vim
  - htop
  - open-iscsi
  - nfs-common

runcmd:
  - systemctl enable --now iscsid
