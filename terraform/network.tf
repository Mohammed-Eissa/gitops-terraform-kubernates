resource "libvirt_network" "k3s" {
  name      = "k3s-network"
  mode      = "nat"
  domain    = "k3s.local"
  addresses = [var.network_cidr]
  autostart = true

  dhcp {
    enabled = true
  }

  dns {
    enabled    = true
    local_only = false
  }
}
