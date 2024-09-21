document.getElementById("fileInput").addEventListener("change", function(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const epwData = e.target.result;
            processEPWData(epwData);
        };
        reader.readAsText(file);
    }
});

function processEPWData(data) {
    const lines = data.split("\n");
    const weatherData = [];

    for (let i = 8; i < lines.length; i++) {
        const line = lines[i];
        const columns = line.split(",");
        if (columns.length > 6) {
            weatherData.push({
                Year: parseInt(columns[0]),
                Month: parseInt(columns[1]),
                Day: parseInt(columns[2]),
                Hour: parseInt(columns[3]),
                Minute: parseInt(columns[4]),
                DryBulbTemperature: parseFloat(columns[6]),
                CloudCover: parseFloat(columns[20]) // Example: cloud cover column from EPW file
            });
        }
    }

    updateCharts(weatherData);
}

function updateCharts(weatherData) {
    const heatmapValues = Array.from({ length: 24 }, () => Array(365).fill(null));
    const cloudCoverageData = Array(12).fill(0).map(() => Array(3).fill(0));
    const dailyTempMap = new Map();

    weatherData.forEach(entry => {
        const dayOfYear = getDayOfYear(entry.Month, entry.Day);
        heatmapValues[entry.Hour - 1][dayOfYear - 1] = entry.DryBulbTemperature;

        if (entry.CloudCover !== null && entry.Month >= 1 && entry.Month <= 12) {
            cloudCoverageData[entry.Month - 1][0] += (entry.CloudCover > 7) ? 1 : 0;
            cloudCoverageData[entry.Month - 1][1] += (entry.CloudCover >= 4 && entry.CloudCover <= 7) ? 1 : 0;
            cloudCoverageData[entry.Month - 1][2] += (entry.CloudCover < 4) ? 1 : 0;
        }

        const dateKey = `${entry.Month}-${entry.Day}`;
        if (!dailyTempMap.has(dateKey)) {
            dailyTempMap.set(dateKey, { temps: [], minTemp: Infinity, maxTemp: -Infinity });
        }
        const dayData = dailyTempMap.get(dateKey);
        dayData.temps.push(entry.DryBulbTemperature);
        dayData.minTemp = Math.min(dayData.minTemp, entry.DryBulbTemperature);
        dayData.maxTemp = Math.max(dayData.maxTemp, entry.DryBulbTemperature);
    });

    updateHeatmap(heatmapValues);
    updateCloudCoverageChart(cloudCoverageData);
    updateTemperatureGraph(dailyTempMap);
}

function getDayOfYear(month, day) {
    const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return day + daysInMonth.slice(0, month - 1).reduce((sum, days) => sum + days, 0);
}

function updateHeatmap(heatmapValues) {
    const hours = Array.from({ length: 24 }, (_, i) => `Hour ${i + 1}`);
    const days = [];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    let dayOfYear = 1;

    months.forEach((month, monthIndex) => {
        const daysInMonth = new Date(2020, monthIndex + 1, 0).getDate();
        for (let day = 1; day <= daysInMonth; day++) {
            days.push(`${month} ${day}`);
            dayOfYear++;
        }
    });

    const heatmapData = [{
        z: heatmapValues,
        x: days,
        y: hours,
        colorscale: 'YlOrRd',
        type: 'heatmap'
    }];

    const layoutHeatmap = {
        title: 'Heatmap of Temperatures',
        xaxis: {
            title: 'Days',
            tickvals: days.filter((_, index) => index % 30 === 0),
            ticktext: days.filter((_, index) => index % 30 === 0)
        },
        yaxis: { title: 'Hours' }
    };

    Plotly.newPlot('heatmap', heatmapData, layoutHeatmap);
}

function updateCloudCoverageChart(cloudCoverageData) {
    const ctxCloudCoverage = document.getElementById('cloudCoverageChart').getContext('2d');
    new Chart(ctxCloudCoverage, {
        type: 'bar',
        data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
            datasets: [
                {
                    label: 'ABOVE range',
                    data: cloudCoverageData.map(data => data[0]),
                    backgroundColor: 'darkgray',
                    barThickness: 40
                },
                {
                    label: 'IN range',
                    data: cloudCoverageData.map(data => data[1]),
                    backgroundColor: 'lightgray',
                    barThickness: 40
                },
                {
                    label: 'BELOW range',
                    data: cloudCoverageData.map(data => data[2]),
                    backgroundColor: 'lightblue',
                    barThickness: 40
                }
            ]
        },
        options: {
            responsive: true,
            scales: {
                x: { stacked: true },
                y: { stacked: true, beginAtZero: true }
            }
        }
    });
}

function updateTemperatureGraph(dailyTempMap) {
    const dailyTempData = [];
    dailyTempMap.forEach((dayData, key) => {
        const [month, day] = key.split("-");
        const avgTemp = dayData.temps.reduce((sum, val) => sum + val, 0) / dayData.temps.length;
        dailyTempData.push({
            Date: new Date(2020, month - 1, day),
            AvgTemp: avgTemp,
            MinTemp: dayData.minTemp,
            MaxTemp: dayData.maxTemp
        });
    });

    dailyTempData.sort((a, b) => a.Date - b.Date);

    const dates = dailyTempData.map(d => d.Date);
    const avgTemps = dailyTempData.map(d => d.AvgTemp);
    const minTemps = dailyTempData.map(d => d.MinTemp);
    const maxTemps = dailyTempData.map(d => d.MaxTemp);

    const traceRange = {
        x: dates,
        y: maxTemps.map((maxTemp, i) => maxTemp - minTemps[i]),
        base: minTemps,
        type: 'bar',
        marker: {
            color: 'rgba(255, 0, 0, 0.3)',
        },
        width: 0.9 * 86400000,
        name: 'Dry Bulb Temperature Range'
    };

    const traceAvg = {
        x: dates,
        y: avgTemps,
        type: 'scatter',
        mode: 'lines',
        line: {
            color: 'red',
            width: 2
        },
        name: 'Average Dry Bulb Temperature'
    };

    const layout = {
        title: 'Average Daily Dry Bulb Temperature with Min-Max Range',
        xaxis: {
            title: 'Date',
            linecolor: 'black',
            linewidth: 2,
        },
        yaxis: {
            title: 'Temperature(˚C)',
            linecolor: 'black',
            linewidth: 2,
            gridcolor: 'lightgrey',
            gridwidth: 1
        },
        plot_bgcolor: 'rgba(0,0,0,0)',
        paper_bgcolor: 'rgba(0,0,0,0)',
        showlegend: true,
    };

    Plotly.newPlot('chart', [traceRange, traceAvg], layout);
}

function showChart(chartId) {
    const chartContainers = ['cloudCoverageContainer', 'heatmapContainer', 'temperatureContainer'];
    chartContainers.forEach(id => {
        document.getElementById(id).style.display = 'none';
    });
    document.getElementById(chartId + 'Container').style.display = 'block';
}
