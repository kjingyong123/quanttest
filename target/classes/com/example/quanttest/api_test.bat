@echo off
:: 1. Navigate to the folder where your Java file lives
cd /d "C:\Users\forst\JY\quanttest\src\main\java\com\example\quanttest"

:: 2. Compile the Java file (converts .java to .class)
:: We do this every time just in case you made changes to the code
javac TwelveData.java

:: 3. Run the program
java TwelveData.java

:: 4. (Optional) Keep the window open for 10 seconds so you can see the result
:: If you want it to run completely hidden, remove the 'timeout' line below
timeout /t 10