$ErrorActionPreference='Stop'
$taskRoot=Split-Path $PSScriptRoot -Parent
if(!$env:JAVA_HOME){$env:JAVA_HOME='D:\DeepSeekHarnessData\jdk-21'}
if(!$env:ANDROID_HOME){$env:ANDROID_HOME='D:\DeepSeekHarnessData\android-sdk'}
$env:JAVA_TOOL_OPTIONS='-Djavax.net.ssl.trustStoreType=Windows-ROOT -Djavax.net.ssl.trustStore=NONE'
Set-Content -LiteralPath (Join-Path $taskRoot 'frontend\android\local.properties') -Value ('sdk.dir='+$env:ANDROID_HOME.Replace('\','/')) -Encoding ascii
Push-Location (Join-Path $taskRoot 'frontend')
try {
    & npm.cmd run build:android
    if($LASTEXITCODE -ne 0){throw 'Web build failed'}
    & '.\android\gradlew.bat' -p '.\android' assembleDebug --console=plain
    if($LASTEXITCODE -ne 0){throw 'Android build failed'}
    New-Item -ItemType Directory -Force -Path (Join-Path $taskRoot 'artifacts') | Out-Null
    Copy-Item -LiteralPath '.\android\app\build\outputs\apk\debug\app-debug.apk' -Destination (Join-Path $taskRoot 'artifacts\DongQi-2.0.1-dev.apk')
}finally{Pop-Location}
