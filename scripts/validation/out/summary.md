# Validation Summary

## Batch metadata

- Batch ID: 1b94953b-5473-40dd-9001-6bba0ce44e9f
- Git SHA: f3ec9d524705da19f7d4233fd10af92b6d3dae5f
- Model: minimax/minimax-m3
- Locale: es-ES
- Sessions recorded: 25
- Date range: 2026-07-09T15:39:49.680Z → 2026-07-11T13:13:59.794Z

## Controlled variables


| Variable           | Setting                                   |
| ------------------ | ----------------------------------------- |
| Session mode       | auto                                      |
| Transform families | idempotence, subset, permutation, inverse |
| Browser locale     | es-ES                                     |
| Weak oracle        | false                                     |
| LLM model          | minimax/minimax-m3                        |


## RQ1: Exploration feasibility


| Metric         | Value |
| -------------- | ----- |
| Total attempts | 100   |
| Successes      | 63    |
| Failures       | 37    |
| Success rate   | 63.0% |
| Failure rate   | 37.0% |




### Per family


| Family      | Attempts | Successes | Success rate |
| ----------- | -------- | --------- | ------------ |
| idempotence | 25       | 20        | 80.0%        |
| subset      | 25       | 17        | 68.0%        |
| permutation | 25       | 9         | 36.0%        |
| inverse     | 25       | 17        | 68.0%        |




### Per domain


| Domain     | Attempts | Successes | Success rate |
| ---------- | -------- | --------- | ------------ |
| amazon     | 20       | 15        | 75.0%        |
| airbnb     | 20       | 14        | 70.0%        |
| booking    | 20       | 3         | 15.0%        |
| github     | 20       | 15        | 75.0%        |
| mediamarkt | 20       | 16        | 80.0%        |




### Domain × family


| Domain     | Family      | Attempts | Successes | Success rate |
| ---------- | ----------- | -------- | --------- | ------------ |
| amazon     | idempotence | 5        | 5         | 100.0%       |
| amazon     | subset      | 5        | 3         | 60.0%        |
| amazon     | permutation | 5        | 2         | 40.0%        |
| amazon     | inverse     | 5        | 5         | 100.0%       |
| airbnb     | idempotence | 5        | 4         | 80.0%        |
| airbnb     | subset      | 5        | 4         | 80.0%        |
| airbnb     | permutation | 5        | 2         | 40.0%        |
| airbnb     | inverse     | 5        | 4         | 80.0%        |
| booking    | idempotence | 5        | 2         | 40.0%        |
| booking    | subset      | 5        | 0         | 0.0%         |
| booking    | permutation | 5        | 0         | 0.0%         |
| booking    | inverse     | 5        | 1         | 20.0%        |
| github     | idempotence | 5        | 5         | 100.0%       |
| github     | subset      | 5        | 5         | 100.0%       |
| github     | permutation | 5        | 3         | 60.0%        |
| github     | inverse     | 5        | 2         | 40.0%        |
| mediamarkt | idempotence | 5        | 4         | 80.0%        |
| mediamarkt | subset      | 5        | 5         | 100.0%       |
| mediamarkt | permutation | 5        | 2         | 40.0%        |
| mediamarkt | inverse     | 5        | 5         | 100.0%       |




## RQ1: Probe failure rate


| Scope                                         | Total probes | Failed | Failure rate |
| --------------------------------------------- | ------------ | ------ | ------------ |
| Per session (aggregate)                       | 1833         | 93     | 5.1%         |
| Per successful MR (aggregate of per-MR rates) | 63           | 25     | 2.5%         |



| Metric                                      | Count | Median | Q1   | Q3   | Observed min | Observed max | Range (max-min) |
| ------------------------------------------- | ----- | ------ | ---- | ---- | ------------ | ------------ | --------------- |
| Per successful MR failure rate distribution | 63    | 0.0%   | 0.0% | 0.0% | 0.0%         | 11.8%        | 11.8%           |


*A box plot is omitted because Q1, the median, and Q3 are all zero; the box and whiskers would collapse to a single point.*

## RQ1: Validated steps (successful MRs)


| Metric       | Count | Median | Q1  | Q3  | Observed min | Observed max | Range (max-min) |
| ------------ | ----- | ------ | --- | --- | ------------ | ------------ | --------------- |
| Source steps | 63    | 2      | 2   | 4   | 1            | 9            | 8               |



| Box plot     | IQR | Lower fence | Upper fence | Lower whisker | Upper whisker | Outliers |
| ------------ | --- | ----------- | ----------- | ------------- | ------------- | -------- |
| Source steps | 2   | -1          | 7           | 1             | 7             | 9        |



| Metric          | Count | Median | Q1  | Q3  | Observed min | Observed max | Range (max-min) |
| --------------- | ----- | ------ | --- | --- | ------------ | ------------ | --------------- |
| Follow-up steps | 63    | 4      | 3   | 5   | 2            | 11           | 9               |



| Box plot        | IQR | Lower fence | Upper fence | Lower whisker | Upper whisker | Outliers |
| --------------- | --- | ----------- | ----------- | ------------- | ------------- | -------- |
| Follow-up steps | 2   | 0           | 8           | 2             | 8             | 11       |




## RQ1: LLM cost (successful MRs)

*latencyMs is the sum of per-call OpenRouter round-trip times, not end-to-end wall clock.*


| Metric                  | Value       |
| ----------------------- | ----------- |
| Price (in / out per 1M) | $0.3 / $1.2 |
| LLM calls               | 1214        |
| Tokens in               | 6934853     |
| Tokens out              | 905876      |
| Latency sum (all calls) | 19947.7 s   |
| Latency median per call | 9.1 s       |
| Latency median per MR   | 250.8 s     |
| Cost (successful MRs)   | $3.17       |




## RQ1: LLM cost per session (all families)


| Domain     | Gen | Calls | Tokens in | Tokens out | Latency sum | Median/call | Cost USD |
| ---------- | --- | ----- | --------- | ---------- | ----------- | ----------- | -------- |
| amazon     | 1   | 53    | 369109    | 45502      | 700.6 s     | 7.9 s       | $0.17    |
| amazon     | 2   | 65    | 415191    | 43678      | 1092.7 s    | 12.2 s      | $0.18    |
| airbnb     | 2   | 76    | 524358    | 65227      | 946.4 s     | 8.3 s       | $0.24    |
| airbnb     | 1   | 81    | 521038    | 54285      | 922.4 s     | 7.4 s       | $0.22    |
| booking    | 1   | 93    | 720781    | 56811      | 959.1 s     | 8.4 s       | $0.28    |
| booking    | 2   | 78    | 547998    | 51593      | 929.7 s     | 10.5 s      | $0.23    |
| github     | 1   | 77    | 419911    | 71798      | 1315.8 s    | 7.2 s       | $0.21    |
| github     | 2   | 64    | 317545    | 59433      | 1118.6 s    | 8.1 s       | $0.17    |
| mediamarkt | 1   | 110   | 573017    | 66584      | 1615.0 s    | 11.1 s      | $0.25    |
| mediamarkt | 2   | 82    | 448901    | 44388      | 1277.4 s    | 8.7 s       | $0.19    |
| mediamarkt | 3   | 93    | 642978    | 44535      | 994.9 s     | 9.2 s       | $0.25    |
| mediamarkt | 4   | 84    | 505296    | 67520      | 1113.1 s    | 10.2 s      | $0.23    |
| mediamarkt | 5   | 83    | 500433    | 55186      | 1345.5 s    | 10.6 s      | $0.22    |
| github     | 3   | 84    | 406478    | 54951      | 1577.3 s    | 8.6 s       | $0.19    |
| github     | 4   | 82    | 411521    | 68585      | 1456.0 s    | 10.7 s      | $0.21    |
| github     | 5   | 74    | 323479    | 54051      | 1249.6 s    | 8.8 s       | $0.16    |
| amazon     | 3   | 61    | 326320    | 53105      | 1214.8 s    | 9.9 s       | $0.16    |
| amazon     | 4   | 63    | 341531    | 53153      | 1424.9 s    | 9.9 s       | $0.17    |
| amazon     | 5   | 62    | 365924    | 39572      | 929.2 s     | 10.0 s      | $0.16    |
| booking    | 3   | 202   | 1338624   | 159192     | 3743.4 s    | 10.5 s      | $0.59    |
| booking    | 4   | 127   | 792555    | 89676      | 2723.2 s    | 13.5 s      | $0.35    |
| booking    | 5   | 67    | 416424    | 29029      | 848.0 s     | 7.7 s       | $0.16    |
| airbnb     | 3   | 85    | 454196    | 63702      | 1865.0 s    | 10.3 s      | $0.21    |
| airbnb     | 4   | 107   | 635783    | 64968      | 1467.1 s    | 8.9 s       | $0.27    |
| airbnb     | 5   | 60    | 363715    | 23287      | 538.7 s     | 7.2 s       | $0.14    |




### Per family (within sessions)


| Domain     | Gen | Family      | Success | Calls | Tokens in | Tokens out | Latency sum | Median/call | Cost USD |
| ---------- | --- | ----------- | ------- | ----- | --------- | ---------- | ----------- | ----------- | -------- |
| amazon     | 1   | idempotence | yes     | 14    | 87690     | 5539       | 106.7 s     | 8.0 s       | $0.03    |
| amazon     | 1   | subset      | no      | 6     | 32703     | 1666       | 60.6 s      | 6.5 s       | $0.01    |
| amazon     | 1   | permutation | no      | 20    | 157570    | 20494      | 291.6 s     | 8.2 s       | $0.07    |
| amazon     | 1   | inverse     | yes     | 13    | 91146     | 17803      | 241.7 s     | 7.9 s       | $0.05    |
| amazon     | 2   | idempotence | yes     | 16    | 101909    | 6419       | 137.4 s     | 9.2 s       | $0.04    |
| amazon     | 2   | subset      | no      | 2     | 11342     | 534        | 35.6 s      | 17.8 s      | $0.0040  |
| amazon     | 2   | permutation | no      | 32    | 207365    | 27292      | 579.2 s     | 14.3 s      | $0.09    |
| amazon     | 2   | inverse     | yes     | 15    | 94575     | 9433       | 340.5 s     | 11.0 s      | $0.04    |
| airbnb     | 2   | idempotence | yes     | 15    | 101148    | 7855       | 137.9 s     | 7.3 s       | $0.04    |
| airbnb     | 2   | subset      | yes     | 21    | 151468    | 14348      | 247.3 s     | 8.2 s       | $0.06    |
| airbnb     | 2   | permutation | no      | 10    | 69597     | 4232       | 86.1 s      | 8.3 s       | $0.03    |
| airbnb     | 2   | inverse     | yes     | 30    | 202145    | 38792      | 475.1 s     | 9.3 s       | $0.11    |
| airbnb     | 1   | idempotence | yes     | 22    | 139122    | 15144      | 250.8 s     | 8.4 s       | $0.06    |
| airbnb     | 1   | subset      | yes     | 26    | 190488    | 8228       | 232.3 s     | 7.4 s       | $0.07    |
| airbnb     | 1   | permutation | yes     | 19    | 119341    | 19979      | 240.8 s     | 7.1 s       | $0.06    |
| airbnb     | 1   | inverse     | yes     | 14    | 72087     | 10934      | 198.5 s     | 5.8 s       | $0.03    |
| booking    | 1   | idempotence | no      | 54    | 407682    | 32118      | 582.7 s     | 11.4 s      | $0.16    |
| booking    | 1   | subset      | no      | 20    | 170639    | 9380       | 169.0 s     | 6.3 s       | $0.06    |
| booking    | 1   | permutation | no      | 9     | 67674     | 3387       | 81.0 s      | 8.0 s       | $0.02    |
| booking    | 1   | inverse     | no      | 10    | 74786     | 11926      | 126.4 s     | 6.3 s       | $0.04    |
| booking    | 2   | idempotence | no      | 21    | 141381    | 11301      | 200.4 s     | 7.6 s       | $0.06    |
| booking    | 2   | subset      | no      | 15    | 103240    | 7563       | 168.7 s     | 8.5 s       | $0.04    |
| booking    | 2   | permutation | no      | 4     | 15312     | 1079       | 37.8 s      | 4.5 s       | $0.0059  |
| booking    | 2   | inverse     | no      | 38    | 288065    | 31650      | 522.9 s     | 12.6 s      | $0.12    |
| github     | 1   | idempotence | yes     | 19    | 116255    | 9914       | 166.5 s     | 7.1 s       | $0.05    |
| github     | 1   | subset      | yes     | 14    | 59454     | 25124      | 267.3 s     | 4.6 s       | $0.05    |
| github     | 1   | permutation | yes     | 31    | 186135    | 23138      | 528.2 s     | 6.7 s       | $0.08    |
| github     | 1   | inverse     | yes     | 13    | 58067     | 13622      | 353.8 s     | 11.2 s      | $0.03    |
| github     | 2   | idempotence | yes     | 17    | 92674     | 15279      | 268.4 s     | 8.6 s       | $0.05    |
| github     | 2   | subset      | yes     | 16    | 78878     | 15637      | 221.6 s     | 7.7 s       | $0.04    |
| github     | 2   | permutation | yes     | 18    | 81583     | 26270      | 557.9 s     | 18.2 s      | $0.06    |
| github     | 2   | inverse     | no      | 13    | 64410     | 2247       | 70.8 s      | 3.5 s       | $0.02    |
| mediamarkt | 1   | idempotence | yes     | 15    | 79472     | 9190       | 207.0 s     | 10.5 s      | $0.03    |
| mediamarkt | 1   | subset      | yes     | 26    | 130839    | 20510      | 576.8 s     | 13.7 s      | $0.06    |
| mediamarkt | 1   | permutation | no      | 49    | 268628    | 30396      | 635.0 s     | 11.3 s      | $0.12    |
| mediamarkt | 1   | inverse     | yes     | 20    | 94078     | 6488       | 196.3 s     | 10.0 s      | $0.04    |
| mediamarkt | 2   | idempotence | yes     | 17    | 99564     | 10687      | 210.3 s     | 7.8 s       | $0.04    |
| mediamarkt | 2   | subset      | yes     | 14    | 78638     | 5039       | 180.7 s     | 5.9 s       | $0.03    |
| mediamarkt | 2   | permutation | yes     | 32    | 157841    | 17472      | 672.9 s     | 16.0 s      | $0.07    |
| mediamarkt | 2   | inverse     | yes     | 19    | 112858    | 11190      | 213.5 s     | 8.1 s       | $0.05    |
| mediamarkt | 3   | idempotence | yes     | 13    | 73616     | 6449       | 138.5 s     | 10.8 s      | $0.03    |
| mediamarkt | 3   | subset      | yes     | 14    | 70694     | 6117       | 160.5 s     | 10.4 s      | $0.03    |
| mediamarkt | 3   | permutation | no      | 43    | 343158    | 25903      | 511.6 s     | 10.4 s      | $0.13    |
| mediamarkt | 3   | inverse     | yes     | 23    | 155510    | 6066       | 184.3 s     | 6.9 s       | $0.05    |
| mediamarkt | 4   | idempotence | no      | 36    | 217344    | 27904      | 466.2 s     | 13.9 s      | $0.10    |
| mediamarkt | 4   | subset      | yes     | 14    | 82521     | 8392       | 159.7 s     | 8.1 s       | $0.03    |
| mediamarkt | 4   | permutation | no      | 19    | 121086    | 9206       | 192.8 s     | 9.1 s       | $0.05    |
| mediamarkt | 4   | inverse     | yes     | 15    | 84345     | 22018      | 294.5 s     | 10.0 s      | $0.05    |
| mediamarkt | 5   | idempotence | yes     | 17    | 86822     | 6769       | 149.9 s     | 7.4 s       | $0.03    |
| mediamarkt | 5   | subset      | yes     | 15    | 86044     | 15929      | 423.0 s     | 10.5 s      | $0.04    |
| mediamarkt | 5   | permutation | yes     | 38    | 267076    | 24639      | 613.3 s     | 12.9 s      | $0.11    |
| mediamarkt | 5   | inverse     | yes     | 13    | 60491     | 7849       | 159.3 s     | 9.3 s       | $0.03    |
| github     | 3   | idempotence | yes     | 17    | 83505     | 9652       | 211.3 s     | 7.1 s       | $0.04    |
| github     | 3   | subset      | yes     | 13    | 51484     | 18916      | 606.1 s     | 7.9 s       | $0.04    |
| github     | 3   | permutation | no      | 37    | 207204    | 18675      | 516.2 s     | 11.3 s      | $0.08    |
| github     | 3   | inverse     | no      | 17    | 64285     | 7708       | 243.7 s     | 8.5 s       | $0.03    |
| github     | 4   | idempotence | yes     | 19    | 107092    | 17285      | 264.6 s     | 10.6 s      | $0.05    |
| github     | 4   | subset      | yes     | 13    | 52518     | 5036       | 116.3 s     | 10.0 s      | $0.02    |
| github     | 4   | permutation | yes     | 20    | 98933     | 23836      | 404.5 s     | 10.8 s      | $0.06    |
| github     | 4   | inverse     | no      | 30    | 152978    | 22428      | 670.6 s     | 12.2 s      | $0.07    |
| github     | 5   | idempotence | yes     | 18    | 76564     | 12369      | 399.8 s     | 13.6 s      | $0.04    |
| github     | 5   | subset      | yes     | 13    | 57191     | 21988      | 274.3 s     | 7.6 s       | $0.04    |
| github     | 5   | permutation | no      | 30    | 127133    | 14777      | 432.8 s     | 9.5 s       | $0.06    |
| github     | 5   | inverse     | yes     | 13    | 62591     | 4917       | 142.7 s     | 6.3 s       | $0.02    |
| amazon     | 3   | idempotence | yes     | 14    | 70264     | 8154       | 224.7 s     | 9.0 s       | $0.03    |
| amazon     | 3   | subset      | yes     | 13    | 74818     | 12145      | 208.9 s     | 9.2 s       | $0.04    |
| amazon     | 3   | permutation | yes     | 20    | 99834     | 19484      | 398.0 s     | 11.8 s      | $0.05    |
| amazon     | 3   | inverse     | yes     | 14    | 81404     | 13322      | 383.2 s     | 6.8 s       | $0.04    |
| amazon     | 4   | idempotence | yes     | 13    | 59949     | 6880       | 159.3 s     | 11.1 s      | $0.03    |
| amazon     | 4   | subset      | yes     | 14    | 76065     | 10576      | 372.8 s     | 8.0 s       | $0.04    |
| amazon     | 4   | permutation | yes     | 16    | 85950     | 15083      | 435.9 s     | 10.9 s      | $0.04    |
| amazon     | 4   | inverse     | yes     | 20    | 119567    | 20614      | 457.0 s     | 13.4 s      | $0.06    |
| amazon     | 5   | idempotence | yes     | 16    | 80356     | 7211       | 202.7 s     | 7.7 s       | $0.03    |
| amazon     | 5   | subset      | yes     | 13    | 79149     | 10249      | 159.2 s     | 11.2 s      | $0.04    |
| amazon     | 5   | permutation | no      | 24    | 165272    | 14870      | 328.6 s     | 8.8 s       | $0.07    |
| amazon     | 5   | inverse     | yes     | 9     | 41147     | 7242       | 238.8 s     | 14.8 s      | $0.02    |
| booking    | 3   | idempotence | yes     | 52    | 351484    | 40094      | 964.1 s     | 10.5 s      | $0.15    |
| booking    | 3   | subset      | no      | 51    | 394362    | 25196      | 531.5 s     | 8.6 s       | $0.15    |
| booking    | 3   | permutation | no      | 44    | 234925    | 34482      | 1107.2 s    | 10.4 s      | $0.11    |
| booking    | 3   | inverse     | no      | 55    | 357853    | 59420      | 1140.6 s    | 14.4 s      | $0.18    |
| booking    | 4   | idempotence | no      | 24    | 152440    | 14814      | 500.1 s     | 14.6 s      | $0.06    |
| booking    | 4   | subset      | no      | 23    | 128936    | 10338      | 396.7 s     | 13.4 s      | $0.05    |
| booking    | 4   | permutation | no      | 29    | 221316    | 23708      | 561.5 s     | 10.8 s      | $0.09    |
| booking    | 4   | inverse     | no      | 51    | 289863    | 40816      | 1264.8 s    | 14.1 s      | $0.14    |
| booking    | 5   | idempotence | yes     | 29    | 189782    | 13786      | 434.9 s     | 8.9 s       | $0.07    |
| booking    | 5   | subset      | no      | 8     | 51132     | 2661       | 75.9 s      | 6.9 s       | $0.02    |
| booking    | 5   | permutation | no      | 11    | 67885     | 2749       | 109.9 s     | 7.7 s       | $0.02    |
| booking    | 5   | inverse     | yes     | 19    | 107625    | 9833       | 227.3 s     | 7.2 s       | $0.04    |
| airbnb     | 3   | idempotence | no      | 19    | 97901     | 7648       | 296.2 s     | 13.6 s      | $0.04    |
| airbnb     | 3   | subset      | yes     | 25    | 152962    | 12105      | 297.2 s     | 8.9 s       | $0.06    |
| airbnb     | 3   | permutation | no      | 10    | 49701     | 3580       | 157.8 s     | 9.2 s       | $0.02    |
| airbnb     | 3   | inverse     | yes     | 31    | 153632    | 40369      | 1113.8 s    | 10.1 s      | $0.09    |
| airbnb     | 4   | idempotence | yes     | 32    | 188246    | 14073      | 335.6 s     | 5.6 s       | $0.07    |
| airbnb     | 4   | subset      | yes     | 33    | 229132    | 14668      | 317.6 s     | 7.3 s       | $0.09    |
| airbnb     | 4   | permutation | yes     | 27    | 133157    | 21052      | 467.1 s     | 15.3 s      | $0.07    |
| airbnb     | 4   | inverse     | yes     | 15    | 85248     | 15175      | 346.8 s     | 18.9 s      | $0.04    |
| airbnb     | 5   | idempotence | yes     | 25    | 140630    | 11500      | 270.3 s     | 7.9 s       | $0.06    |
| airbnb     | 5   | subset      | no      | 1     | 0         | 0          | 0 ms        | n/a         | $0.0000  |
| airbnb     | 5   | permutation | no      | 12    | 75317     | 3101       | 82.1 s      | 4.9 s       | $0.03    |
| airbnb     | 5   | inverse     | no      | 22    | 147768    | 8686       | 186.2 s     | 7.4 s       | $0.05    |




### Aggregate per family (all sessions)


| Family      | Attempts | Calls | Tokens in | Tokens out | Latency sum | Median/call | Cost USD |
| ----------- | -------- | ----- | --------- | ---------- | ----------- | ----------- | -------- |
| idempotence | 25       | 554   | 3342892   | 328034     | 7286.0 s    | 9.4 s       | $1.40    |
| subset      | 25       | 423   | 2594697   | 282345     | 6259.4 s    | 8.4 s       | $1.12    |
| permutation | 25       | 604   | 3628993   | 428884     | 10029.7 s   | 10.6 s      | $1.60    |
| inverse     | 25       | 532   | 3116524   | 440548     | 9793.4 s    | 10.0 s      | $1.46    |



| Metric            | Value     |
| ----------------- | --------- |
| Total sessions    | 25        |
| Total LLM calls   | 2113      |
| Total tokens in   | 12683106  |
| Total tokens out  | 1479811   |
| Total latency sum | 33368.6 s |
| Total cost USD    | $5.58     |




## RQ1: Time to draft


| Metric     | Count | Median  | Q1      | Q3      | Observed min | Observed max | Range (max-min) |
| ---------- | ----- | ------- | ------- | ------- | ------------ | ------------ | --------------- |
| Wall clock | 63    | 630.8 s | 449.5 s | 856.8 s | 270.9 s      | 3129.4 s     | 2858.4 s        |



| Box plot   | IQR     | Lower fence | Upper fence | Lower whisker | Upper whisker | Outliers                               |
| ---------- | ------- | ----------- | ----------- | ------------- | ------------- | -------------------------------------- |
| Wall clock | 407.4 s | -161.6 s    | 1467.9 s    | 270.9 s       | 1456.5 s      | 1597.6 s, 1751.4 s, 1783.3 s, 3129.4 s |




## RQ1: Phase decomposition


| Phase            | Detail                                                                                                |
| ---------------- | ----------------------------------------------------------------------------------------------------- |
| Plan             | calls=63, tokensIn=176251, tokensOut=92305, latencySum=1663.8 s, latencyMedian=16.9 s, cost=$0.16     |
| Explore loop     | calls=1014, tokensIn=6438376, tokensOut=498106, latencySum=13033.3 s, latencyMedian=8.7 s, cost=$2.53 |
| Probes wall time | n=1013, median=21.3 s                                                                                 |
| Smoke wall time  | n=126, median=27.3 s                                                                                  |
| Observe          | calls=74, tokensIn=320226, tokensOut=315465, latencySum=5250.6 s, latencyMedian=57.1 s, cost=$0.47    |
| Compile          | {"note":"Negligible LLM time; compile uses MR updated_at after explore job start","mrCount":63}       |




## RQ2: Execute completion


| Metric                 | Value |
| ---------------------- | ----- |
| Compiled MRs           | 63    |
| Completed initial runs | 48    |
| Completion rate        | 76.2% |




### By domain


| Domain     | Compiled | Completed | Completion rate |
| ---------- | -------- | --------- | --------------- |
| amazon     | 15       | 13        | 86.7%           |
| airbnb     | 14       | 9         | 64.3%           |
| booking    | 3        | 3         | 100.0%          |
| github     | 15       | 13        | 86.7%           |
| mediamarkt | 16       | 10        | 62.5%           |




## RQ2: Replay duration (initial auto runs)


| Metric                 | Count | Median | Q1     | Q3     | Observed min | Observed max | Range (max-min) |
| ---------------------- | ----- | ------ | ------ | ------ | ------------ | ------------ | --------------- |
| Execute pair wall time | 63    | 24.3 s | 18.0 s | 51.3 s | 13.7 s       | 197.7 s      | 184.0 s         |



| Box plot               | IQR    | Lower fence | Upper fence | Lower whisker | Upper whisker | Outliers                                    |
| ---------------------- | ------ | ----------- | ----------- | ------------- | ------------- | ------------------------------------------- |
| Execute pair wall time | 33.3 s | -32.0 s     | 101.3 s     | 13.7 s        | 84.1 s        | 131.4 s, 133.3 s, 157.3 s, 189.8 s, 197.7 s |




## RQ2: Replay consistency


| Class             | Count | Rate  |
| ----------------- | ----- | ----- |
| Stable            | 16    | 45.7% |
| Verdict drift     | 0     | 0.0%  |
| Observation drift | 7     | 20.0% |
| Execute failure   | 12    | 34.3% |




### By domain


| Domain     | Stable | Verdict drift | Observation drift | Execute failure |
| ---------- | ------ | ------------- | ----------------- | --------------- |
| amazon     | 5      | 0             | 1                 | 2               |
| airbnb     | 2      | 0             | 2                 | 4               |
| booking    | 2      | 0             | 1                 | 0               |
| github     | 7      | 0             | 0                 | 1               |
| mediamarkt | 0      | 0             | 3                 | 5               |




### By family


| Family      | Stable | Verdict drift | Observation drift | Execute failure |
| ----------- | ------ | ------------- | ----------------- | --------------- |
| idempotence | 7      | 0             | 1                 | 2               |
| subset      | 4      | 0             | 0                 | 4               |
| permutation | 1      | 0             | 2                 | 5               |
| inverse     | 4      | 0             | 4                 | 1               |




## RQ3: Strict verdicts


| Metric                 | Value |
| ---------------------- | ----- |
| Completed initial runs | 48    |
| Pass                   | 22    |
| Fail                   | 26    |
| Pass rate              | 45.8% |
| Fail rate              | 54.2% |




### Per family


| Family      | Total | Pass | Fail | Pass rate |
| ----------- | ----- | ---- | ---- | --------- |
| idempotence | 18    | 11   | 7    | 61.1%     |
| subset      | 12    | 4    | 8    | 33.3%     |
| permutation | 4     | 1    | 3    | 25.0%     |
| inverse     | 14    | 6    | 8    | 42.9%     |




### Observable-item outcomes (completed initial runs)


| Metric                     | Value |
| -------------------------- | ----- |
| Evaluated observable items | 319   |
| Pass                       | 256   |
| Fail                       | 63    |
| Pass rate                  | 80.3% |
| Fail rate                  | 19.7% |




### Observable-item outcomes per family


| Family      | Evaluated observable items | Pass | Fail | Pass rate | Fail rate |
| ----------- | -------------------------- | ---- | ---- | --------- | --------- |
| idempotence | 121                        | 102  | 19   | 84.3%     | 15.7%     |
| subset      | 75                         | 59   | 16   | 78.7%     | 21.3%     |
| permutation | 24                         | 18   | 6    | 75.0%     | 25.0%     |
| inverse     | 99                         | 77   | 22   | 77.8%     | 22.2%     |


