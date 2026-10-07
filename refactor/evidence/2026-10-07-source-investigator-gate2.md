# Source Investigator — Gate 2 setup

Public source inspection on 2026-10-07 shows the SwimSystem calendar currently lists 89 competitions and exposes the upcoming Torneio Regional da 1ª Região (Pré-Mirim/Petiz), 10–11/10/2026, Curitiba, LCM. Following the calendar link resolves to the meet page whose URL contains external meet id c8587533-2e44-4b08-991f-f827170c7344.

This observation was obtained from the public calendar, not from a production-data mutation.

A V2 read-only fetch adapter and independent GitHub Actions job were added. The job fetches /meets and passes the returned HTML to discoverSwimSystemMeetIds. The target UUID is not supplied to the script.

Gate 2 remains pending until the independent live workflow output proves discovery.
