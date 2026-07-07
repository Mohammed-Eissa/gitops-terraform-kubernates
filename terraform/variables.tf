variable "libvirt_uri" {
  description = "Libvirt connection URI"
  default     = "qemu:///system"
}

variable "base_image_url" {
  description = "Ubuntu 22.04 LTS cloud image"
  default     = "https://cloud-images.ubuntu.com/jammy/current/jammy-server-cloudimg-amd64.img"
}

variable "vcpus" {
  description = "vCPU threads per VM"
  default     = 2
}

variable "memory_mb" {
  description = "RAM per VM in MB"
  default     = 4096
}

variable "disk_size_gb" {
  description = "Disk size per VM in GB"
  default     = 15
}

variable "network_cidr" {
  description = "NAT network CIDR"
  default     = "10.17.3.0/24"
}

variable "gateway" {
  description = "NAT network gateway"
  default     = "10.17.3.1"
}

variable "ssh_public_key_path" {
  description = "Path to SSH public key injected into VMs"
  default     = "~/.ssh/id_rsa.pub"
}

variable "vm_user" {
  description = "Non-root user created on each VM"
  default     = "depi"
}

locals {
  vms = {
    master  = { ip = "10.17.3.10", role = "master" }
    agent-1 = { ip = "10.17.3.11", role = "agent" }
    agent-2 = { ip = "10.17.3.12", role = "agent" }
  }

  disk_size_bytes = var.disk_size_gb * 1073741824
  ssh_public_key  = file(pathexpand(var.ssh_public_key_path))
}
