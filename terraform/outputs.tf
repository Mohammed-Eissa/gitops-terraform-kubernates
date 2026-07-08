output "vm_ips" {
  description = "Static IP addresses of all VMs"
  value = {
    for name, vm in local.vms : name => vm.ip
  }
}

output "master_ip" {
  description = "k3s control plane IP"
  value       = local.vms["master"].ip
}

output "agent_ips" {
  description = "k3s agent IPs"
  value = [
    for name, vm in local.vms : vm.ip if vm.role == "agent"
  ]
}

output "ssh_connect" {
  description = "SSH commands to connect to each VM"
  value = {
    for name, vm in local.vms :
    name => "ssh ${var.vm_user}@${vm.ip}"
  }
}
