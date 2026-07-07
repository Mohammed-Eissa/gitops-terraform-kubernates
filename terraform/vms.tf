# Base image downloaded once, shared as backing store for all VM disks
resource "libvirt_volume" "base" {
  name   = "ubuntu-22.04-base.qcow2"
  pool   = "default"
  source = var.base_image_url
  format = "qcow2"
}

# Per-VM thin-clone disk on top of the base image
resource "libvirt_volume" "disk" {
  for_each = local.vms

  name           = "k3s-${each.key}.qcow2"
  pool           = "default"
  base_volume_id = libvirt_volume.base.id
  size           = local.disk_size_bytes
  format         = "qcow2"
}

# Per-VM cloud-init ISO (user-data + network-config)
resource "libvirt_cloudinit_disk" "init" {
  for_each = local.vms

  name  = "k3s-${each.key}-init.iso"
  pool  = "default"

  user_data = templatefile("${path.module}/cloud-init/user-data.yaml.tpl", {
    hostname       = "k3s-${each.key}"
    vm_user        = var.vm_user
    ssh_public_key = local.ssh_public_key
  })

  network_config = templatefile("${path.module}/cloud-init/network-config.yaml.tpl", {
    ip      = each.value.ip
    gateway = var.gateway
    mac     = each.value.mac
  })
}

# VM domains
resource "libvirt_domain" "vm" {
  for_each = local.vms

  name   = "k3s-${each.key}"
  memory = var.memory_mb
  vcpu   = var.vcpus

  cloudinit = libvirt_cloudinit_disk.init[each.key].id

  cpu {
    mode = "host-passthrough"
  }

  xml {
    xslt = <<-XSLT
      <?xml version="1.0" ?>
      <xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
        <xsl:output omit-xml-declaration="yes" indent="yes"/>
        <xsl:template match="node()|@*">
          <xsl:copy><xsl:apply-templates select="node()|@*"/></xsl:copy>
        </xsl:template>
        <xsl:template match="/domain/cpu">
          <cpu mode="host-passthrough">
            <topology sockets="1" cores="2" threads="1"/>
          </cpu>
        </xsl:template>
      </xsl:stylesheet>
    XSLT
  }

  network_interface {
    network_id = libvirt_network.k3s.id
    mac        = each.value.mac
  }

  disk {
    volume_id = libvirt_volume.disk[each.key].id
  }

  console {
    type        = "pty"
    target_type = "serial"
    target_port = "0"
  }

  graphics {
    type        = "spice"
    listen_type = "address"
    autoport    = true
  }

  autostart = true
}
