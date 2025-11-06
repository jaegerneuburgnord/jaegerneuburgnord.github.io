# Huawei Modem Setup Guide

## Problem
Your Huawei E3372 modem (ID `12d1:14dc`) is being detected as a storage device instead of a modem. The kernel log shows:
```
scsi 0:0:0:0: Direct-Access     HUAWEI   TF CARD Storage  2.31 PQ: 0 ANSI: 2
```

This is because Huawei modems have a "zero-CD" feature where they appear as USB storage devices first to provide Windows drivers. The device needs to be switched to modem mode.

## Solution

### Option 1: Manual Switch (Quick Test)

Run the provided script to manually switch the modem:

```bash
./switch_modem.sh
```

This will:
1. Check if usb_modeswitch is installed
2. Detect the Huawei modem
3. Switch it to modem mode using `usb_modeswitch -v 12d1 -p 14dc -J`
4. Verify that serial ports (ttyUSB) appear

After successful switching, you should see `/dev/ttyUSB0`, `/dev/ttyUSB1`, `/dev/ttyUSB2` appear.

### Option 2: Automatic Switch (Permanent Solution)

To automatically switch the modem every time it's plugged in, install a udev rule:

1. Copy the udev rule to the system directory:
```bash
sudo cp 40-huawei-modem.rules /etc/udev/rules.d/
```

2. Reload udev rules:
```bash
sudo udevadm control --reload-rules
sudo udevadm trigger
```

3. Unplug and replug the modem, or run:
```bash
sudo usb_modeswitch -v 12d1 -p 14dc -J
```

The modem will now automatically switch to modem mode whenever it's plugged in.

## Verification

After switching, verify the serial ports are available:

```bash
ls -la /dev/ttyUSB*
```

You should see something like:
```
crw-rw---- 1 root dialout 188, 0 Nov  6 10:30 /dev/ttyUSB0
crw-rw---- 1 root dialout 188, 1 Nov  6 10:30 /dev/ttyUSB1
crw-rw---- 1 root dialout 188, 2 Nov  6 10:30 /dev/ttyUSB2
```

## Which Port to Use?

Huawei E3372 typically creates 3 serial ports:
- **`/dev/ttyUSB0`** - Primary modem interface (use this for AT commands and SMS)
- `/dev/ttyUSB1` - Diagnostic interface
- `/dev/ttyUSB2` - PC UI interface

## Configuring Your Application

Once the modem is switched and serial ports are available, configure your SMS server:

### Via API:
```bash
curl -X POST http://localhost:8000/modem/configure \
  -H "Content-Type: application/json" \
  -d '{
    "port": "/dev/ttyUSB0",
    "baudrate": 115200,
    "timeout": 10
  }'
```

### Check Status:
```bash
curl http://localhost:8000/status
```

### List Available Ports:
```bash
curl http://localhost:8000/modem/ports
```

## Troubleshooting

### 1. Permission Denied
If you get "Permission denied" when accessing `/dev/ttyUSB0`, add your user to the `dialout` group:

```bash
sudo usermod -a -G dialout $USER
```

Then log out and log back in for the changes to take effect.

### 2. Modem Not Responding
If the modem switches but doesn't respond to AT commands:
- Try different serial ports (ttyUSB0, ttyUSB1, ttyUSB2)
- Check if another process is using the port: `sudo lsof /dev/ttyUSB0`
- Verify the modem is registered on the network (can take 10-30 seconds after switching)

### 3. Check Modem Status
```bash
# View kernel messages about the modem
sudo dmesg | grep -i usb | tail -20

# Check USB devices
lsusb | grep -i huawei

# Test modem with AT commands
sudo minicom -D /dev/ttyUSB0
# In minicom, type: AT
# Expected response: OK
```

## Dependencies

Make sure these packages are installed:

```bash
sudo apt-get update
sudo apt-get install usb-modeswitch usb-modeswitch-data
```

## Additional Information

- **Modem Model**: Huawei E3372 LTE/UMTS/GSM HiLink Modem
- **Vendor ID**: 12d1 (Huawei Technologies Co., Ltd.)
- **Product ID (storage mode)**: 14dc
- **Product ID (modem mode)**: Typically changes to 1506 or similar after switching

For more information about usb_modeswitch and Huawei modems:
- https://www.draisberghof.de/usb_modeswitch/
- https://www.ubuntu.com/usb_modeswitch
