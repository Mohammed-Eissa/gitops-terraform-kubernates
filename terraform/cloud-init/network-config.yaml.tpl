version: 2
ethernets:
  id0:
    match:
      macaddress: ${mac}
    dhcp4: false
    addresses:
      - ${ip}/24
    gateway4: ${gateway}
    nameservers:
      addresses:
        - 8.8.8.8
        - 8.8.4.4
