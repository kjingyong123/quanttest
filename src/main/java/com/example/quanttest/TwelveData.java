package com.example.quanttest;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

public class TwelveData{
    public static void main(String[] args) {
        // --- CONFIGURATION ---
        String apiKey = "9b30cb5823944374a3668af9d868e162"; // Put your real key inside the quotes
        String symbol = "AAPL";
        String url = "https://api.twelvedata.com/price?symbol=" + symbol + "&apikey=" + apiKey;

        try {
            // 1. Create the Request
            HttpClient client = HttpClient.newHttpClient();
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .GET()
                    .build();

            // 2. Send the Request
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            String result = response.body();

            // 3. Prepare the Output
            String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
            String logEntry = "[" + timestamp + "] " + symbol + " Price: " + result + System.lineSeparator();

            // 4. Print to Console (for manual testing)
            System.out.print(logEntry);

            // 5. Save to a File (so you can check it later)
            Files.write(Paths.get("api_results.txt"), 
                        logEntry.getBytes(), 
                        StandardOpenOption.CREATE, 
                        StandardOpenOption.APPEND);

        } catch (Exception e) {
            System.err.println("Error occurred: " + e.getMessage());
            e.printStackTrace();
        }
    }
}