<?php
// ── CONFIG ────────────────────────────────────────────────────────────────
$WHATSAPP_PHONE  = "+447700000000";   // roofer's WhatsApp number (international format)
$CALLMEBOT_KEY   = "YOUR_KEY_HERE";   // get from callmebot.com
$EMAIL_TO        = "roofer@example.com";
$EMAIL_FROM      = "leads@yoursite.com";
$BUSINESS_NAME   = "ProRoof UK";

// ── CORS ──────────────────────────────────────────────────────────────────
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json");

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    http_response_code(405);
    exit(json_encode(["error" => "Method not allowed"]));
}

// ── COLLECT FORM DATA ─────────────────────────────────────────────────────
$job_type    = htmlspecialchars($_POST["job_type"]    ?? "Not specified");
$description = htmlspecialchars($_POST["description"] ?? "Not specified");
$name        = htmlspecialchars($_POST["name"]        ?? "Not specified");
$phone       = htmlspecialchars($_POST["phone"]       ?? "Not specified");
$postcode    = htmlspecialchars($_POST["postcode"]    ?? "Not specified");
$files       = $_FILES["files"] ?? [];

// ── HANDLE UPLOADED FILES ─────────────────────────────────────────────────
$upload_dir = __DIR__ . "/uploads/";
if (!is_dir($upload_dir)) mkdir($upload_dir, 0755, true);

$saved_files = [];
$attachment_paths = [];

if (!empty($files["name"][0])) {
    foreach ($files["name"] as $i => $filename) {
        if ($files["error"][$i] !== UPLOAD_ERR_OK) continue;
        $ext = pathinfo($filename, PATHINFO_EXTENSION);
        $safe_name = uniqid("lead_") . "." . preg_replace('/[^a-zA-Z0-9]/', '', $ext);
        $dest = $upload_dir . $safe_name;
        if (move_uploaded_file($files["tmp_name"][$i], $dest)) {
            $saved_files[] = $safe_name;
            $attachment_paths[] = $dest;
        }
    }
}

$file_count = count($saved_files);

// ── WHATSAPP NOTIFICATION (CallMeBot) ─────────────────────────────────────
// CallMeBot setup: roofer adds +34 644 58 83 72 to contacts, then sends
// "I allow callmebot to send me messages" to get their API key.
// Free, no app needed — just regular WhatsApp.

$wa_message = "🔔 *New Lead - {$BUSINESS_NAME}*\n\n"
    . "👤 *Name:* {$name}\n"
    . "📞 *Phone:* {$phone}\n"
    . "📍 *Postcode:* {$postcode}\n"
    . "🏠 *Job Type:* {$job_type}\n"
    . "📝 *Description:* {$description}\n"
    . "📸 *Files:* {$file_count} uploaded (see email)\n\n"
    . "Reply to this customer ASAP! ⚡";

$wa_encoded = urlencode($wa_message);
$wa_url = "https://api.callmebot.com/whatsapp.php"
    . "?phone={$WHATSAPP_PHONE}"
    . "&text={$wa_encoded}"
    . "&apikey={$CALLMEBOT_KEY}";

$ch = curl_init($wa_url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 10);
$wa_response = curl_exec($ch);
curl_close($ch);

// ── EMAIL WITH ATTACHMENTS ────────────────────────────────────────────────
$boundary = "boundary_" . uniqid();
$subject  = "New Lead: {$name} — {$job_type} in {$postcode}";

$email_body = "You have a new lead from your website!\n\n"
    . "Name:        {$name}\n"
    . "Phone:       {$phone}\n"
    . "Postcode:    {$postcode}\n"
    . "Job Type:    {$job_type}\n"
    . "Description: {$description}\n"
    . "Files:       {$file_count} attached\n\n"
    . "Call them back ASAP!";

// Build multipart email with attachments
$headers  = "From: {$BUSINESS_NAME} Leads <{$EMAIL_FROM}>\r\n";
$headers .= "Reply-To: {$EMAIL_FROM}\r\n";
$headers .= "MIME-Version: 1.0\r\n";
$headers .= "Content-Type: multipart/mixed; boundary=\"{$boundary}\"\r\n";

$body  = "--{$boundary}\r\n";
$body .= "Content-Type: text/plain; charset=UTF-8\r\n\r\n";
$body .= $email_body . "\r\n\r\n";

foreach ($attachment_paths as $path) {
    if (!file_exists($path)) continue;
    $filename  = basename($path);
    $mime_type = mime_content_type($path) ?: "application/octet-stream";
    $data      = base64_encode(file_get_contents($path));

    $body .= "--{$boundary}\r\n";
    $body .= "Content-Type: {$mime_type}; name=\"{$filename}\"\r\n";
    $body .= "Content-Transfer-Encoding: base64\r\n";
    $body .= "Content-Disposition: attachment; filename=\"{$filename}\"\r\n\r\n";
    $body .= $data . "\r\n\r\n";
}

$body .= "--{$boundary}--";

mail($EMAIL_TO, $subject, $body, $headers);

// ── RESPOND ───────────────────────────────────────────────────────────────
echo json_encode(["success" => true, "files" => $file_count]);
