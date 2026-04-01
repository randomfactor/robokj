
import { handleRegisterSinger } from './roster';
import { handleAddSongRequest } from './requests';
import { BackgroundService } from './service';

const SEED_SET_INDEX: 0 | 1 | 2 = 2;

type SeedSinger = { w2gId: string; stageName: string };
type SeedRequest = { w2gId: string; title: string; url: string };

interface SeedSet {
    show: Record<string, any>;
    singers: SeedSinger[];
    requests: SeedRequest[];
}

const SEED_SETS: Record<0 | 1 | 2, SeedSet> = {
    // Set 0: minimal
    0: {
        show: {
            venueName: 'Mini Seed Dev3',
            streamKey: 'cz1v5cqlbp9uij7hwy',
        },
        singers: [
            { w2gId: 'admin', stageName: 'RoboKJ' }
        ],
        requests: [
            { w2gId: 'admin', title: 'Countdown Master', url: 'https://youtu.be/OStsxpT-Y1M' }
        ]
    },

    // Set 1: short test.
    1: {
        show: {
            venueName: 'Seed Dev3',
            maxSongDurationSeconds: 15,
            durationInHours: 1.0 / 30.0,
            streamKey: 'cz1v5cqlbp9uij7hwy',
        },
        singers: [
            { w2gId: 'admin', stageName: 'RoboKJ' },
            { w2gId: 'User-TEST0', stageName: 'Brad' },
            { w2gId: 'User-TEST1', stageName: 'Chad' }
        ],
        requests: [
            { w2gId: 'admin', title: 'RoboKJ Instructions', url: 'https://youtu.be/MEbs-gGfD2I' },
            { w2gId: 'admin', title: 'Countdown Master', url: 'https://youtu.be/OStsxpT-Y1M' },
            { w2gId: 'User-TEST0', title: 'Let It Be Unplayable', url: 'https://www.youtube.com/watch?v=KSRDIB1BQ08' },
            { w2gId: 'User-TEST0', title: 'Countdown 11', url: 'https://youtu.be/IG_ThYspaJA' },
            { w2gId: 'User-TEST0', title: 'Countdown 08', url: 'https://youtu.be/3XOQjkNyoIg' },
            { w2gId: 'User-TEST0', title: 'Burning For You', url: 'https://www.youtube.com/watch?v=8v3t_L2aw64' },
            { w2gId: 'User-TEST0', title: 'Don\'t Fear The Reaper', url: 'https://www.youtube.com/watch?v=-f_w4ZAYk3E' },
            { w2gId: 'User-TEST1', title: 'Countdown 09', url: 'https://youtu.be/Lg7OimPUjt8' },
            { w2gId: 'User-TEST1', title: 'Countdown 12', url: 'https://youtu.be/5ymwMWajK0k' },
            { w2gId: 'User-TEST1', title: 'Dizz Knee Land', url: 'https://www.youtube.com/watch?v=WpS67Qjialc' },
            { w2gId: 'User-TEST1', title: 'Godzilla', url: 'https://www.youtube.com/watch?v=boAQkZnXoKA' },
            { w2gId: 'User-TEST1', title: 'Joan Crawford', url: 'https://www.youtube.com/watch?v=6U47UrFXN20' }
        ]
    },

    // Set 2: long test.
    2: {
        show: {
            venueName: 'Long Seed Dev3',
            maxSongDurationSeconds: 270,
            durationInHours: 3,
            streamKey: 'cz1v5cqlbp9uij7hwy',
        },
        singers: [
            { w2gId: 'admin', stageName: 'RoboKJ' },
            { w2gId: 'User-TEST0', stageName: 'Brad' },
            { w2gId: 'User-TEST1', stageName: 'Chad' },
            { w2gId: 'User-TEST2', stageName: 'Thad' },
            { w2gId: 'User-TEST3', stageName: 'Tad' },
            { w2gId: 'User-TEST4', stageName: 'Vlad' },
            { w2gId: 'User-TEST5', stageName: 'Gad' },
            { w2gId: 'User-TEST6', stageName: 'Bill' },
            { w2gId: 'User-TEST7', stageName: 'Will' },
            { w2gId: 'User-TEST8', stageName: 'Jill' },
            { w2gId: 'User-TEST9', stageName: 'Phil' }
        ],
        requests: [
            { w2gId: 'User-TEST0', title: 'Pride and Joy - by Stevie Ray Vaughan', url: 'https://www.youtube.com/watch?v=_hPXGkh49_Y' },
            { w2gId: 'User-TEST1', title: 'Two Out Of Three Ain\'t Bad - by Meatloaf', url: 'https://www.youtube.com/watch?v=_IQ0tb1rSL4' },
            { w2gId: 'User-TEST2', title: 'Juice - by Lizzo', url: 'https://www.youtube.com/watch?v=_Ts8S0umCiY' },
            { w2gId: 'User-TEST3', title: 'Away From The Sun - by 3 Doors Down', url: 'https://www.youtube.com/watch?v=_wHT1mhYOqo' },
            { w2gId: 'User-TEST4', title: 'Don\'t Fear The Reaper - by Blue Öyster Cult', url: 'https://www.youtube.com/watch?v=-f_w4ZAYk3E' },
            { w2gId: 'User-TEST5', title: 'Bad Case Of Loving You - by Robert Palmer', url: 'https://www.youtube.com/watch?v=216NSap3fXM' },
            { w2gId: 'User-TEST0', title: 'Baker Street - by Gerry Rafferty', url: 'https://www.youtube.com/watch?v=2Elk9zEo5t8' },
            { w2gId: 'User-TEST1', title: 'Devil Woman - by Cliff Richard', url: 'https://www.youtube.com/watch?v=2QDj4bxPMSE' },
            { w2gId: 'User-TEST2', title: 'Woodstock - by Crosby, Stills, Nash, and Young', url: 'https://www.youtube.com/watch?v=2WqMpC6iU0k' },
            { w2gId: 'User-TEST3', title: 'This Is The Life - by Weird Al Yankovic', url: 'https://www.youtube.com/watch?v=3ihYXyKx9I8' },
            { w2gId: 'User-TEST4', title: 'Creep - by Brian Justin Crum', url: 'https://www.youtube.com/watch?v=3RqKXebGsMU' },
            { w2gId: 'User-TEST5', title: 'Love Will Tear Us Apart Again - by Joy Division', url: 'https://www.youtube.com/watch?v=42Nij5mkhV4' },
            { w2gId: 'User-TEST0', title: 'Tequila - by Dan + Shay', url: 'https://www.youtube.com/watch?v=471itGC2sE4' },
            { w2gId: 'User-TEST1', title: 'You Were On My Mind - by We Five', url: 'https://www.youtube.com/watch?v=4tu6vOw1XlE' },
            { w2gId: 'User-TEST2', title: 'Joan Crawford - by Blue Öyster Cult', url: 'https://www.youtube.com/watch?v=6U47UrFXN20' },
            { w2gId: 'User-TEST3', title: 'Undone (The Sweater Song) - by Weezer', url: 'https://www.youtube.com/watch?v=83ZHsaGB-_Q' },
            { w2gId: 'User-TEST4', title: 'I Didn\'t Mean To Turn You On - by Robert Palmer', url: 'https://www.youtube.com/watch?v=8soZfmE3J4U' },
            { w2gId: 'User-TEST5', title: 'Burning For You - by Blue Öyster Cult', url: 'https://www.youtube.com/watch?v=8v3t_L2aw64' },
            { w2gId: 'User-TEST0', title: 'Mustang Sally - by The Commitment', url: 'https://www.youtube.com/watch?v=9_cYhT3M1KY' },
            { w2gId: 'User-TEST1', title: 'One - by U2', url: 'https://www.youtube.com/watch?v=A-6vOZ6cNOA' },
            { w2gId: 'User-TEST2', title: 'River Man - by Nick Drake', url: 'https://www.youtube.com/watch?v=adLDi96lK-E' },
            { w2gId: 'User-TEST3', title: 'Hold On - by Santana', url: 'https://www.youtube.com/watch?v=asnbrQeqZJw' },
            { w2gId: 'User-TEST4', title: 'Head Over Heels - by Tears for Fears', url: 'https://www.youtube.com/watch?v=B10oD2__9Bg' },
            { w2gId: 'User-TEST5', title: 'Fly Like an Eagle - by Steve Miller', url: 'https://www.youtube.com/watch?v=bbv5NHt96Hk' },
            { w2gId: 'User-TEST0', title: 'Godzilla - by Blue Öyster Cult', url: 'https://www.youtube.com/watch?v=boAQkZnXoKA' },
            { w2gId: 'User-TEST1', title: 'Under the Milky Way - by The Church', url: 'https://www.youtube.com/watch?v=BtSX6LLpM8s' },
            { w2gId: 'User-TEST2', title: 'Come And Get It - by Badfinger', url: 'https://www.youtube.com/watch?v=cA1Tqvifx3I' },
            { w2gId: 'User-TEST3', title: 'What the Fox Say - by Ylvis', url: 'https://www.youtube.com/watch?v=CHOgHQOVm1c' },
            { w2gId: 'User-TEST4', title: 'Don\'t Dream It\'s Over - by Crowded House', url: 'https://www.youtube.com/watch?v=CM-vvXJmNr4' },
            { w2gId: 'User-TEST5', title: 'Dust on the Wind - by Velvet Sundown', url: 'https://www.youtube.com/watch?v=cuyytd_lXn0' },
            { w2gId: 'User-TEST0', title: 'No Matter What - by Badfinger', url: 'https://www.youtube.com/watch?v=czJQRuXCbdQ' },
            { w2gId: 'User-TEST1', title: 'The Next Time I Fall - by Cetera / Grant', url: 'https://www.youtube.com/watch?v=E4l33GCZK2k' },
            { w2gId: 'User-TEST2', title: 'Secret Garden - by Bruce Springsteen', url: 'https://www.youtube.com/watch?v=Eg66kWf7UF4' },
            { w2gId: 'User-TEST3', title: 'Timothy - by The Buoys', url: 'https://www.youtube.com/watch?v=EOkRe7-gWyw' },
            { w2gId: 'User-TEST4', title: 'Stay - by Oingo Boingo', url: 'https://www.youtube.com/watch?v=FJ2RX0nKBVA' },
            { w2gId: 'User-TEST5', title: 'Girls & Boys - by Blur', url: 'https://www.youtube.com/watch?v=FuovRBUagPQ' },
            { w2gId: 'User-TEST0', title: 'Some Like It Hot - by Power Station', url: 'https://www.youtube.com/watch?v=FYU28FRDtUs' },
            { w2gId: 'User-TEST1', title: 'Broken - by Seether / Amy Lee', url: 'https://www.youtube.com/watch?v=gatay3rT_jE' },
            { w2gId: 'User-TEST2', title: 'We Are All On Drugs - by Weezer', url: 'https://www.youtube.com/watch?v=gcc0W_HxUgo' },
            { w2gId: 'User-TEST3', title: 'Please Come Home For Christmas - by Bon Jovi', url: 'https://www.youtube.com/watch?v=GKm4ISQyR-k' },
            { w2gId: 'User-TEST6', title: 'Stupid Girl - by Garbage', url: 'https://www.youtube.com/watch?v=GnBbB7Eft9A' },
            { w2gId: 'User-TEST6', title: 'Fever - by The Black Keys', url: 'https://www.youtube.com/watch?v=GwVBVpPAW-c' },
            { w2gId: 'User-TEST6', title: 'Mad World - by Gary Jules', url: 'https://www.youtube.com/watch?v=H-lum6BBF3g' },
            { w2gId: 'User-TEST6', title: 'You\'ll Never Find - by Lou Rawls', url: 'https://www.youtube.com/watch?v=hB2a13mE2hY' },
            { w2gId: 'User-TEST6', title: 'Only Happy When It Rains - by Garbage', url: 'https://www.youtube.com/watch?v=hv989pjwCC0' },
            { w2gId: 'User-TEST7', title: 'Are You Gonna Go My Way - by Lenny Kravitz', url: 'https://www.youtube.com/watch?v=iecV-eHfLNs' },
            { w2gId: 'User-TEST7', title: 'Color My World - by Chicago', url: 'https://www.youtube.com/watch?v=iJgyuvTayjg' },
            { w2gId: 'User-TEST7', title: 'Boom Boom Ba', url: 'https://www.youtube.com/watch?v=j9YyjJxKWnI' },
            { w2gId: 'User-TEST7', title: 'Bad Day - by Daniel Powter', url: 'https://www.youtube.com/watch?v=JCp84_B2Nd8' },
            { w2gId: 'User-TEST7', title: 'Simply Irresistable - by Robert Palmer', url: 'https://www.youtube.com/watch?v=jM6Y2g_nODM' },
            { w2gId: 'User-TEST8', title: 'Jenny - by Tommy Tutone', url: 'https://www.youtube.com/watch?v=joJgqYOziYw' },
            { w2gId: 'User-TEST8', title: 'Minute By Minute - by Doobie Brothers', url: 'https://www.youtube.com/watch?v=jrPC4luIZbU' },
            { w2gId: 'User-TEST8', title: 'When You Say Nothing At All - by Keith Whitley', url: 'https://www.youtube.com/watch?v=k2ALC3yFSdE' },
            { w2gId: 'User-TEST8', title: 'Closer - by The Chainsmokers', url: 'https://www.youtube.com/watch?v=kaMm0JvFWhM' },
            { w2gId: 'User-TEST8', title: 'Godzilla - by Blue Oyster Cult', url: 'https://www.youtube.com/watch?v=kDO648hBwZE' },
            { w2gId: 'User-TEST9', title: 'The Diary of Horace Wimp - by E.L.O.', url: 'https://www.youtube.com/watch?v=kgHgInZw190' },
            { w2gId: 'User-TEST9', title: 'I Like You Better Than Me - by Bebe Rexha', url: 'https://www.youtube.com/watch?v=l8_MOltmUKM' },
            { w2gId: 'User-TEST9', title: 'Low - by T. Pain', url: 'https://www.youtube.com/watch?v=LhDVZVNiQlM' },
            { w2gId: 'User-TEST9', title: 'Uprising - by Muse', url: 'https://www.youtube.com/watch?v=lhsjiyGnsxY' },
            { w2gId: 'User-TEST9', title: 'Next Summer - by Damiano David', url: 'https://www.youtube.com/watch?v=LR8R-etDTj0' },
        ]
    }
};

export async function seedTestData(service: BackgroundService) {
    const selectedSet = SEED_SETS[SEED_SET_INDEX];

    // Seed Show
    await new Promise((resolve) => service.handleSetShowInfo(selectedSet.show, resolve as any));

    // Seed Singers sequentially
    for (const singer of selectedSet.singers) {
        await new Promise((resolve) => handleRegisterSinger(singer, resolve as any));
    }

    // Seed Requests sequentially
    for (const req of selectedSet.requests) {
        await new Promise((resolve) => handleAddSongRequest(service, req.w2gId, { title: req.title, url: req.url }, resolve as any));
    }
}
