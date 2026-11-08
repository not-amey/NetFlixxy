Add-Type -AssemblyName System.Drawing

function New-RoundedRectanglePath([float]$x, [float]$y, [float]$w, [float]$h, [float]$radius) {
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $diameter = [float]($radius * 2.0)
    
    # Top-Left Arc
    $path.AddArc($x, $y, $diameter, $diameter, 180.0, 90.0)
    
    # Top-Right Arc
    $path.AddArc([float]($x + $w - $diameter), $y, $diameter, $diameter, 270.0, 90.0)
    
    # Bottom-Right Arc
    $path.AddArc([float]($x + $w - $diameter), [float]($y + $h - $diameter), $diameter, $diameter, 0.0, 90.0)
    
    # Bottom-Left Arc
    $path.AddArc($x, [float]($y + $h - $diameter), $diameter, $diameter, 90.0, 90.0)
    
    $path.CloseFigure()
    return $path
}

function Generate-NetflixBitmap([int]$canvasSize) {
    $bmp = New-Object System.Drawing.Bitmap($canvasSize, $canvasSize, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)
    
    $scale = [float]($canvasSize / 256.0)
    
    # 1. Dark Rounded App Tile Background (Matching Netflix official app icon)
    $tileMargin = [float](8.0 * $scale)
    $tileSize = [float]($canvasSize - (2.0 * $tileMargin))
    $tileRadius = [float](48.0 * $scale)
    
    $tilePath = New-RoundedRectanglePath $tileMargin $tileMargin $tileSize $tileSize $tileRadius
    
    # Deep Black/Charcoal gradient background
    $ptStart = New-Object System.Drawing.PointF(0.0, $tileMargin)
    $ptEnd = New-Object System.Drawing.PointF(0.0, [float]($tileMargin + $tileSize))
    $cTop = [System.Drawing.ColorTranslator]::FromHtml("#181818")
    $cBottom = [System.Drawing.ColorTranslator]::FromHtml("#000000")
    $tileBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($ptStart, $ptEnd, $cTop, $cBottom)
    $g.FillPath($tileBrush, $tilePath)
    $tileBrush.Dispose()
    
    # Subtle inner border for contrast
    $borderPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(45, 255, 255, 255), [float]([Math]::Max(1.0, 1.2 * $scale)))
    $g.DrawPath($borderPen, $tilePath)
    $borderPen.Dispose()
    
    # 2. Authentic Netflix 'N' Geometry
    # In 256x256 space: Left = 71, Right = 185 (width = 114)
    # Pillar width = 38
    # Top = 36, Bottom = 220 (height = 184)
    $x0 = [float](71.0 * $scale)
    $x1 = [float](109.0 * $scale)
    $x2 = [float](147.0 * $scale)
    $x3 = [float](185.0 * $scale)
    
    $yTop = [float](36.0 * $scale)
    $yBot = [float](220.0 * $scale)
    
    # 3. Left Red Vertical Pillar (#B1060F / #B81D24)
    $leftPillar = New-Object System.Drawing.Drawing2D.GraphicsPath
    $leftPillar.AddLine($x0, $yTop, $x1, $yTop)
    $leftPillar.AddLine($x1, $yTop, $x1, $yBot)
    $leftPillar.AddLine($x1, $yBot, $x0, $yBot)
    $leftPillar.CloseFigure()
    
    $crimsonBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#B1060F"))
    $g.FillPath($crimsonBrush, $leftPillar)
    $leftPillar.Dispose()
    
    # 4. Right Red Vertical Pillar (#E50914)
    $rightPillar = New-Object System.Drawing.Drawing2D.GraphicsPath
    $rightPillar.AddLine($x2, $yTop, $x3, $yTop)
    $rightPillar.AddLine($x3, $yTop, $x3, $yBot)
    $rightPillar.AddLine($x3, $yBot, $x2, $yBot)
    $rightPillar.CloseFigure()
    
    $rightBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#E50914"))
    $g.FillPath($rightBrush, $rightPillar)
    $rightPillar.Dispose()
    
    # 5. Drop Shadow Cast by Diagonal Sash onto the Left Pillar
    $shadowPoly = [System.Drawing.PointF[]]@(
        (New-Object System.Drawing.PointF($x0, $yTop)),
        (New-Object System.Drawing.PointF([float]($x1 + (12.0 * $scale)), $yTop)),
        (New-Object System.Drawing.PointF([float]($x3 + (6.0 * $scale)), $yBot)),
        (New-Object System.Drawing.PointF($x2, $yBot))
    )
    $shadowBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(90, 0, 0, 0))
    $g.FillPolygon($shadowBrush, $shadowPoly)
    $shadowBrush.Dispose()
    
    # 6. Center Diagonal Sash (Signature Netflix Red #E50914)
    $sashPoly = [System.Drawing.PointF[]]@(
        (New-Object System.Drawing.PointF($x0, $yTop)),
        (New-Object System.Drawing.PointF($x1, $yTop)),
        (New-Object System.Drawing.PointF($x3, $yBot)),
        (New-Object System.Drawing.PointF($x2, $yBot))
    )
    
    $ptSashStart = New-Object System.Drawing.PointF($x0, $yTop)
    $ptSashEnd = New-Object System.Drawing.PointF($x3, $yBot)
    $sashBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $ptSashStart,
        $ptSashEnd,
        [System.Drawing.ColorTranslator]::FromHtml("#FF1822"),
        [System.Drawing.ColorTranslator]::FromHtml("#E50914")
    )
    $g.FillPolygon($sashBrush, $sashPoly)
    $sashBrush.Dispose()
    
    $crimsonBrush.Dispose()
    $rightBrush.Dispose()
    $tilePath.Dispose()
    $g.Dispose()
    
    return $bmp
}

Write-Host "Generating Netflix Logo Icon assets..."

# Generate master 256x256 bitmap
$masterBmp = Generate-NetflixBitmap 256
$masterBmp.Save("assets\icon.png", [System.Drawing.Imaging.ImageFormat]::Png)
$masterBmp.Save("public\icon.png", [System.Drawing.Imaging.ImageFormat]::Png)
Write-Host "Saved assets\icon.png and public\icon.png"

# Convert to standard Windows GDI icon format
$hIcon = $masterBmp.GetHicon()
$ico = [System.Drawing.Icon]::FromHandle($hIcon)

$paths = @("assets\icon.ico", "public\icon.ico", "public\favicon.ico")
foreach ($p in $paths) {
    $fs = New-Object System.IO.FileStream($p, [System.IO.FileMode]::Create)
    $ico.Save($fs)
    $fs.Dispose()
    Write-Host "Saved $p"
}

$ico.Dispose()
$masterBmp.Dispose()

Write-Host "All Netflix icons successfully generated and saved!"
