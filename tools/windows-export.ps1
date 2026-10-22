# ParaCut R4.2: explicitly launched Windows GUI for the local CLI renderer.
# No server, background service, administrative permissions, downloads or shell evaluation.
# Requires Windows PowerShell 5.1, Node.js and a local FFmpeg/FFprobe installation.
$ErrorActionPreference = 'Stop'

try {
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.Application]::EnableVisualStyles()

    function Show-Notice([string] $message, [string] $heading = 'ParaCut Local MP4') {
        [void][System.Windows.Forms.MessageBox]::Show(
            $message, $heading,
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Information
        )
    }

    function Select-File([string] $heading, [string] $filter) {
        $chooser = New-Object System.Windows.Forms.OpenFileDialog
        try {
            $chooser.Title = $heading
            $chooser.Filter = $filter
            $chooser.CheckFileExists = $true
            $chooser.Multiselect = $false
            if ($chooser.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) { return $null }
            return $chooser.FileName
        }
        finally { $chooser.Dispose() }
    }

    function Select-MediaFolder {
        $chooser = New-Object System.Windows.Forms.FolderBrowserDialog
        try {
            $chooser.Description = '2/3: Choose the folder containing the original video and audio files'
            $chooser.ShowNewFolderButton = $false
            if ($chooser.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) { return $null }
            return $chooser.SelectedPath
        }
        finally { $chooser.Dispose() }
    }

    function Select-Output([string] $draft) {
        $chooser = New-Object System.Windows.Forms.SaveFileDialog
        try {
            $chooser.Title = '3/3: Choose a NEW MP4 output filename'
            $chooser.Filter = 'MP4 video (*.mp4)|*.mp4'
            $chooser.DefaultExt = 'mp4'
            $chooser.AddExtension = $true
            $chooser.OverwritePrompt = $false  # Refuse overwrite explicitly below.
            $chooser.FileName = [System.IO.Path]::GetFileNameWithoutExtension($draft) + '-final.mp4'
            if ($chooser.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) { return $null }
            return $chooser.FileName
        }
        finally { $chooser.Dispose() }
    }

    function Select-RenderOptions {
        $dialog = New-Object System.Windows.Forms.Form
        try {
            $dialog.Text = 'ParaCut: MP4 Render Quality'
            $dialog.ClientSize = New-Object System.Drawing.Size(425, 215)
            $dialog.StartPosition = 'CenterScreen'
            $dialog.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::FixedDialog
            $dialog.MaximizeBox = $false
            $dialog.MinimizeBox = $false

            $heading = New-Object System.Windows.Forms.Label
            $heading.Location = New-Object System.Drawing.Point(18, 18)
            $heading.Size = New-Object System.Drawing.Size(390, 35)
            $heading.Text = 'Choose a local MP4 quality preset (defaults to R5.6 Balanced).'
            $dialog.Controls.Add($heading)

            $quality = New-Object System.Windows.Forms.ComboBox
            $quality.Location = New-Object System.Drawing.Point(18, 60)
            $quality.Size = New-Object System.Drawing.Size(388, 25)
            $quality.DropDownStyle = [System.Windows.Forms.ComboBoxStyle]::DropDownList
            [void]$quality.Items.AddRange([object[]]@('Balanced', 'Compact', 'High'))
            $quality.SelectedIndex = 0
            $dialog.Controls.Add($quality)

            $protect = New-Object System.Windows.Forms.CheckBox
            $protect.Location = New-Object System.Drawing.Point(18, 105)
            $protect.Size = New-Object System.Drawing.Size(390, 39)
            $protect.Text = 'Protect master audio with a 0.95 sample-peak limiter'
            $protect.Checked = $false
            $dialog.Controls.Add($protect)

            $yes = New-Object System.Windows.Forms.Button
            $yes.Text = 'Continue'
            $yes.Location = New-Object System.Drawing.Point(215, 160)
            $yes.Size = New-Object System.Drawing.Size(90, 32)
            $yes.DialogResult = [System.Windows.Forms.DialogResult]::OK
            $dialog.Controls.Add($yes)
            $dialog.AcceptButton = $yes

            $no = New-Object System.Windows.Forms.Button
            $no.Text = 'Cancel'
            $no.Location = New-Object System.Drawing.Point(316, 160)
            $no.Size = New-Object System.Drawing.Size(90, 32)
            $no.DialogResult = [System.Windows.Forms.DialogResult]::Cancel
            $dialog.Controls.Add($no)
            $dialog.CancelButton = $no

            if ($dialog.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) {
                return $null
            }
            return @{
                Quality = $quality.SelectedItem.ToString().ToLowerInvariant()
                Protect = [bool]$protect.Checked
            }
        }
        finally { $dialog.Dispose() }
    }

    $repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
    $renderer = Join-Path $repoRoot 'scripts\studio-export-local.mjs'
    if (-not (Test-Path -LiteralPath $renderer -PathType Leaf)) {
        throw 'Local render script was not found. Use a complete ParaCut repository checkout.'
    }

    $node = Get-Command node.exe -ErrorAction SilentlyContinue
    if (-not $node) {
        throw 'Node.js is not available. Install Node.js 20+ and reopen this launcher.'
    }

    # Prefer FFmpeg on PATH. A portable, user-supplied ffmpeg.exe with ffprobe.exe
    # in the same directory is also supported. No automatic downloads.
    $ffmpeg = Get-Command ffmpeg.exe -ErrorAction SilentlyContinue
    $ffprobe = Get-Command ffprobe.exe -ErrorAction SilentlyContinue
    if (-not $ffmpeg -or -not $ffprobe) {
        $answer = [System.Windows.Forms.MessageBox]::Show(
            'FFmpeg and FFprobe are not both on PATH. Browse for your own ffmpeg.exe? The companion will also check for ffprobe.exe beside it.',
            'ParaCut: FFmpeg required',
            [System.Windows.Forms.MessageBoxButtons]::YesNo,
            [System.Windows.Forms.MessageBoxIcon]::Question
        )
        if ($answer -ne [System.Windows.Forms.DialogResult]::Yes) {
            Write-Host 'Cancelled: FFmpeg is required but not installed or selected.'
            exit 0
        }
        $selected = Select-File 'Select your installed ffmpeg.exe' 'FFmpeg executable (ffmpeg.exe)|ffmpeg.exe'
        if (-not $selected) {
            Write-Host 'Cancelled before any render.'
            exit 0
        }
        $sibling = Join-Path (Split-Path -Parent $selected) 'ffprobe.exe'
        if (-not (Test-Path -LiteralPath $sibling -PathType Leaf)) {
            throw 'ffprobe.exe was not found beside ffmpeg.exe. Please provide both executables in the same folder.'
        }
        $ffmpegPath = $selected
        $ffprobePath = $sibling
    }
    else {
        $ffmpegPath = $ffmpeg.Source
        $ffprobePath = $ffprobe.Source
    }

    # All paths are passed as distinct process arguments. No Invoke-Expression,
    # Start-Process ArgumentList string, command interpolation, or shell execution.
    $draft = Select-File '1/3: Select a ParaCut Save Draft JSON' 'ParaCut JSON draft (*.json)|*.json'
    if (-not $draft) {
        Write-Host 'Cancelled before any render.'
        exit 0
    }
    $mediaDir = Select-MediaFolder
    if (-not $mediaDir) {
        Write-Host 'Cancelled before any render.'
        exit 0
    }
    $output = Select-Output $draft
    if (-not $output) {
        Write-Host 'Cancelled before any render.'
        exit 0
    }
    if ([System.IO.Path]::GetExtension($output).ToLowerInvariant() -ne '.mp4') {
        throw 'Output must be an .mp4 file.'
    }
    if (Test-Path -LiteralPath $output) {
        throw 'Output already exists. ParaCut never overwrites movies. Select a new filename.'
    }

    $renderOptions = Select-RenderOptions
    if ($null -eq $renderOptions) {
        Write-Host 'Render cancelled at quality selection. No movie was written.'
        exit 0
    }
    # One argument vector for dry-run and actual render. Never construct a command string.
    $renderArgs = @(
        '--draft', $draft, '--media-dir', $mediaDir, '--out', $output,
        '--ffmpeg', $ffmpegPath, '--ffprobe', $ffprobePath,
        '--quality', $renderOptions.Quality
    )
    if ($renderOptions.Protect) {
        $renderArgs += '--audio-protect'
    }

    Write-Host ('Preset: ' + $renderOptions.Quality + '; master limiter: ' + $renderOptions.Protect)
    Write-Host ''
    Write-Host 'ParaCut: validating your draft and the original media...'
    Write-Host ('Draft:  ' + $draft)
    Write-Host ('Media:  ' + $mediaDir)
    Write-Host ('Output: ' + $output)
    Write-Host ''
    & $node.Source $renderer @renderArgs --dry-run
    if ($LASTEXITCODE -ne 0) {
        throw 'Dry-run validation failed. No movie was rendered. See the details in this window.'
    }

    $newline = [Environment]::NewLine
    $prompt = 'Draft: ' + $draft + $newline +
        'Original media: ' + $mediaDir + $newline +
        'MP4 output: ' + $output + $newline +
        'Quality: ' + $renderOptions.Quality + '; audio protection: ' + $renderOptions.Protect + $newline + $newline +
        'Render locally now? Existing files will not be overwritten.'
    $confirm = [System.Windows.Forms.MessageBox]::Show(
        $prompt, 'ParaCut: confirm MP4 render',
        [System.Windows.Forms.MessageBoxButtons]::YesNo,
        [System.Windows.Forms.MessageBoxIcon]::Question
    )
    if ($confirm -ne [System.Windows.Forms.DialogResult]::Yes) {
        Write-Host 'Render cancelled after successful validation. No movie was written.'
        exit 0
    }

    # The same validated inputs are passed directly to the existing CLI.
    & $node.Source $renderer @renderArgs
    if ($LASTEXITCODE -ne 0) {
        throw 'Local render failed or output verification failed. See the console details.'
    }
    if (-not (Test-Path -LiteralPath $output -PathType Leaf)) {
        throw 'The renderer exited without producing the MP4 output.'
    }
    Write-Host ''
    Write-Host ('MP4 export complete: ' + $output)
    Show-Notice ('Verified local MP4 export completed.' + $newline + $newline + $output)
    exit 0
}
catch {
    $message = $_.Exception.Message
    Write-Host ('ParaCut export error: ' + $message) -ForegroundColor Red
    try {
        [void][System.Windows.Forms.MessageBox]::Show(
            $message, 'ParaCut MP4 export failed',
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Error
        )
    } catch { }
    exit 1
}
