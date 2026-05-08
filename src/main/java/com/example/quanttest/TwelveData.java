package com.example.quanttest;

import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import org.springframework.beans.factory.annotation.Value;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

@Component
public class TwelveData implements CommandLineRunner {

    // Pulls from the environment variable set in GitHub Actions
    @Value("${TWELVE_DATA_KEY}")
    private String apiKey;

    @Override
    public void run(String... args) {
        String symbol = "AAPL";
        String url = "https://api.twelvedata.com/price?symbol=" + symbol + "&apikey=" + apiKey;

        try {
            HttpClient client = HttpClient.newHttpClient();
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .GET()
                    .build();

            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            String result = response.body();

            String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
            String logEntry = "[" + timestamp + "] " + symbol + " Price: " + result + System.lineSeparator();

            System.out.print(logEntry);

            // GitHub Actions will save this in the runner's workspace
            Files.write(Paths.get("api_results.txt"), 
                        logEntry.getBytes(), 
                        StandardOpenOption.CREATE, 
                        StandardOpenOption.APPEND);

            System.out.println("Task Complete. Shutting down...");
                
            // This tells Spring Boot to stop so the GitHub Action can finish
            System.exit(0);

        } catch (Exception e) {
            System.err.println("Error occurred: " + e.getMessage());
            System.exit(1); // Exit with error code if it fails
        }
    }
}
