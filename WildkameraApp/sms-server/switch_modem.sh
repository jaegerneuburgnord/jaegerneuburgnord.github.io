#!/bin/bash
# Script to switch Huawei E3372 modem from storage mode to modem mode

echo "=== Huawei Modem Mode Switch ==="
echo ""

# Check if usb_modeswitch is installed
if ! command -v usb_modeswitch &> /dev/null; then
    echo "ERROR: usb_modeswitch is not installed"
    echo "Install it with: sudo apt-get install usb-modeswitch usb-modeswitch-data"
    exit 1
fi

# Check if Huawei device is connected
echo "Checking for Huawei modem..."
if ! lsusb | grep -q "12d1:14dc"; then
    echo "WARNING: Huawei E3372 modem not found (ID 12d1:14dc)"
    echo ""
    echo "Available USB devices:"
    lsusb | grep -i huawei
    exit 1
fi

echo "✓ Huawei E3372 modem found (ID 12d1:14dc)"
echo ""

# Check current serial ports
echo "Current serial ports:"
ls -la /dev/ttyUSB* /dev/ttyACM* 2>/dev/null || echo "  No ttyUSB or ttyACM devices found"
echo ""

# Switch the modem
echo "Switching modem to modem mode..."
echo "Running: sudo usb_modeswitch -v 12d1 -p 14dc -J"
echo ""

sudo usb_modeswitch -v 12d1 -p 14dc -J

# Wait for device to re-enumerate
echo ""
echo "Waiting 5 seconds for device to re-enumerate..."
sleep 5

# Check for serial ports again
echo ""
echo "Serial ports after switching:"
if ls /dev/ttyUSB* /dev/ttyACM* 2>/dev/null; then
    echo ""
    echo "✓ SUCCESS! Serial ports are now available."
    echo ""
    echo "You can now use the modem with your application."
    echo "Typical modem ports: /dev/ttyUSB0, /dev/ttyUSB1, /dev/ttyUSB2"
    echo ""
    echo "To configure the modem in your application, use:"
    echo "  POST /modem/configure"
    echo "  {\"port\": \"/dev/ttyUSB0\", \"baudrate\": 115200, \"timeout\": 10}"
else
    echo "  No ttyUSB or ttyACM devices found"
    echo ""
    echo "The switch may have failed. Check dmesg for more info:"
    echo "  sudo dmesg | tail -30"
fi
