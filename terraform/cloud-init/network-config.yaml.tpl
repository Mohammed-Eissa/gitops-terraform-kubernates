version: 2
ethernets:
  enp1s0:
    dhcp4: false
    addresses:
      - ${ip}/24
    gateway4: ${gateway}
    nameservers:
      addresses:
        - 8.8.8.8
        - 8.8.4.4
