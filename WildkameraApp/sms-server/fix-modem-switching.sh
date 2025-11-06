#!/bin/bash
# Script to fix Huawei E3372 modem switching

set -e

# Get the script directory first, before changing directories
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "=== Fixing Huawei E3372 Modem Switching ==="
echo

# Step 1: Create usb_modeswitch configuration file for E3372
echo "1. Creating usb_modeswitch configuration file..."
if [ ! -f /usr/share/usb_modeswitch/12d1:14dc ]; then
    sudo cp "$SCRIPT_DIR/12d1:14dc" /usr/share/usb_modeswitch/
    sudo chmod 644 /usr/share/usb_modeswitch/12d1:14dc
    echo "   ✓ Configuration file created"
else
    echo "   ✓ Configuration file already exists"
fi
echo

# Step 2: Copy the updated udev rule
echo "2. Installing udev rule..."
sudo cp "$SCRIPT_DIR/40-huawei-modem.rules" /etc/udev/rules.d/
sudo chmod 644 /etc/udev/rules.d/40-huawei-modem.rules
echo "   ✓ Udev rule installed"
echo

# Step 3: Reload udev rules
echo "3. Reloading udev rules..."
sudo udevadm control --reload-rules
echo "   ✓ Udev rules reloaded"
echo

# Step 4: Trigger the device
echo "4. Triggering USB device mode switch..."
sudo udevadm trigger --action=add --attr-match=idVendor=12d1 --attr-match=idProduct=14dc
echo "   ✓ Device triggered"
echo

# Step 5: Wait and check result
echo "5. Waiting for device to switch modes..."
sleep 3

echo
echo "=== Current USB Devices ==="
lsusb | grep -i "12d1\|Huawei"

echo
echo "=== Checking for modem device ==="
if ls /dev/ttyUSB* 2>/dev/null; then
    echo "   ✓ Modem device(s) found!"
else
    echo "   ✗ No modem devices found yet"
    echo "   Try unplugging and replugging the modem"
fi

echo
echo "=== Done ==="
echo "If the modem is still at product ID 14dc, try unplugging and replugging it."
echo "The udev rule will automatically trigger when the device is connected."
