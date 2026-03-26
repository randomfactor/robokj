
import { handleRegisterSinger } from './roster';
import { handleAddSongRequest } from './requests';
import { BackgroundService } from './service';

export async function seedTestData(service: BackgroundService) {
    /*
    const seedShow = {
        venueName: 'Seed Dev2',
        streamKey: 'iid2362wq6yvwxhkw5',
        durationInHours: 4
    };

    const seedSingers = [
        { w2gId: 'admin', stageName: 'Adam' },
        { w2gId: 'User-RJMHU', stageName: 'Brad' },
        { w2gId: 'User-KQAZU', stageName: 'Chad' }
    ];
    
    // As modified by user
    const seedRequests = [
        { w2gId: 'admin', title: 'Countdown 09', url: 'https://youtu.be/Lg7OimPUjt8' },
        { w2gId: 'admin', title: 'I Like You Better Than Me - Bebe Rexha', url: 'https://www.youtube.com/watch?v=l8_MOltmUKM' },
        { w2gId: 'admin', title: 'Countdown Master', url: 'https://youtu.be/kR56-5ycO0M' },
        { w2gId: 'User-RJMHU', title: 'Let It Be Unplayable', url: 'https://www.youtube.com/watch?v=KSRDIB1BQ08' },
        { w2gId: 'User-RJMHU', title: 'Countdown 11', url: 'https://youtu.be/IG_ThYspaJA' },
        { w2gId: 'User-RJMHU', title: 'Countdown 08', url: 'https://youtu.be/3XOQjkNyoIg' },
        { w2gId: 'User-KQAZU', title: 'Countdown 12', url: 'https://youtu.be/5ymwMWajK0k' },
        { w2gId: 'User-KQAZU', title: 'Countdown 10', url: 'https://youtu.be/lYuuW0moz50' },
        { w2gId: 'User-KQAZU', title: 'Dizz Knee Land', url: 'https://www.youtube.com/watch?v=WpS67Qjialc' }
    ];
    */


    const seedShow = {
        venueName: 'Seed Dev3',
        streamKey: 'cz1v5cqlbp9uij7hwy', // https://w2g.tv/?r=cz1v5cqlbp9uij7hwy
        durationInHours: 4
    };

    const seedSingers = [
        { w2gId: 'admin', stageName: 'RoboKJ' }
    ];

    // As modified by user
    const seedRequests = [
        {
            w2gId: 'admin',
            title: 'https://w2g.tv/?r=ojwj0wdd41psx7gcm9',
            url: 'Sorry Randall K, \"https://w2g.tv/?r=ojwj0wdd41psx7gcm9\" is already in the queue'
        }
    ];

    // Seed Show
    await new Promise((resolve) => service.handleSetShowInfo(seedShow, resolve as any));

    // Seed Singers sequentially
    for (const singer of seedSingers) {
        await new Promise((resolve) => handleRegisterSinger(singer, resolve as any));
    }

    // Seed Requests sequentially
    for (const req of seedRequests) {
        await new Promise((resolve) => handleAddSongRequest(req.w2gId, { title: req.title, url: req.url }, resolve as any));
    }
}
