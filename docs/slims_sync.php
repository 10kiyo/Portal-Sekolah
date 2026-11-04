<?php
/**
 * Script sinkronisasi data murid dari Cloudflare Workers ke SLiMS
 * File ini bisa disalin ke folder SLiMS lokal untuk menjalankan sinkronisasi
 */

// Konfigurasi koneksi MySQL SLiMS
$host = 'localhost';
$port = 8889;
$dbname = 'db_slims';
$username = 'root';
$password = 'root';

// Kunci akses ke Workers endpoint
$workersKey = 'slims-secret-key-123';

// Endpoint Workers
$endpointUrl = 'http://localhost:8788/api/slims-member?key=' . $workersKey;

// Inisialisasi cURL
$ch = curl_init();

// Set cURL options
curl_setopt($ch, CURLOPT_URL, $endpointUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false); // untuk development lokal
curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);

// Ambil data JSON dari endpoint
$response = curl_exec($ch);

if ($response === false) {
    die('cURL Error: ' . curl_error($ch));
}

// Decode JSON response
$data = json_decode($response, true);

if ($data === null) {
    die('Error: Response invalid atau kosong dari endpoint Workers.');
}

// Connect ke MySQL SLiMS
$conn = new mysqli($host, $username, $password, $dbname, $port);

if ($conn->connect_error) {
    die('Koneksi Gagal: ' . $conn->connect_error);
}

// Pastikan koneksi menggunakan charset utf8
$conn->set_charset('utf8mb4');

// Proses setiap data murid
$successCount = 0;
$errorCount = 0;

foreach ($data as $member) {
    $memberId = $conn->real_escape_string($member['member_id']);
    $memberName = $conn->real_escape_string($member['member_name']);
    $gender = (int) $member['gender'];
    $memberTypeId = (int) $member['member_type_id'];
    $instName = $conn->real_escape_string($member['inst_name']);
    $isActive = (int) $member['is_active'];

    // Query INSERT INTO member dengan ON DUPLICATE KEY UPDATE
    // Field: member_id, member_name, gender, member_type_id, inst_name, is_active, input_date, last_update
    $sql = "INSERT INTO member (member_id, member_name, gender, member_type_id, inst_name, is_active, input_date, last_update)
            VALUES ('$memberId', '$memberName', $gender, $memberTypeId, '$instName', $isActive, NOW(), NOW())
            ON DUPLICATE KEY UPDATE
            member_name = VALUES(member_name),
            gender = VALUES(gender),
            last_update = NOW()";

    if ($conn->query($sql) === TRUE) {
        $successCount++;
    } else {
        $errorCount++;
        error_log("SQL Error for member $memberId: " . $conn->error);
    }
}

// Tutup koneksi
$conn->close();

// Ringkasan
echo "=== Laporan Sinkronisasi SLiMS ===\n";
echo "Total data diterima: " . count($data) . "\n";
echo "Berhasil disinkronkan: $successCount\n";
echo "Error: $errorCount\n";
echo "Selesai.\n";