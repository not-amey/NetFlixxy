$WshShell = New-Object -ComObject WScript.Shell
$AppDir = "c:\Users\Zore\Documents\NetFlixxy"
$ExePath = Join-Path $AppDir "node_modules\electron\dist\electron.exe"
$IconPath = Join-Path $AppDir "assets\icon.ico"

# List candidate desktop paths
$DesktopPaths = @(
    [System.Environment]::GetFolderPath('Desktop'),
    (Join-Path $env:USERPROFILE "Desktop"),
    (Join-Path $env:USERPROFILE "OneDrive\Desktop"),
    (Join-Path $env:PUBLIC "Desktop")
) | Select-Object -Unique

foreach ($desk in $DesktopPaths) {
    if (Test-Path $desk) {
        $ShortcutPath = Join-Path $desk "NetFlixxy.lnk"
        $Shortcut = $WshShell.CreateShortcut($ShortcutPath)
        $Shortcut.TargetPath = $ExePath
        $Shortcut.Arguments = """$AppDir"""
        $Shortcut.WorkingDirectory = $AppDir
        $Shortcut.Description = "NetFlixxy - Personal Offline Netflix-Style Player"
        $Shortcut.IconLocation = "$IconPath,0"
        $Shortcut.Save()
        Write-Host "Updated shortcut with Netflix icon at: $ShortcutPath"
    }
}

# Flush Windows Icon Cache via SHChangeNotify
try {
    $code = @'
    using System;
    using System.Runtime.InteropServices;
    public class ShellNotifier {
        [DllImport("shell32.dll")]
        public static extern void SHChangeNotify(int wEventId, int uFlags, IntPtr dwItem1, IntPtr dwItem2);
    }
'@
    Add-Type -TypeDefinition $code -ErrorAction SilentlyContinue
    [ShellNotifier]::SHChangeNotify(0x08000000, 0, [IntPtr]::Zero, [IntPtr]::Zero) # SHCNE_ASSOCCHANGED
    Write-Host "Notified Windows Shell to refresh icon cache."
} catch {
    Write-Host "Shell refresh notification skipped: $_"
}
