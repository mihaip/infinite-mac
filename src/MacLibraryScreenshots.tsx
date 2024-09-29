import "./MacLibraryScreenshots.css";
import {useRef, useState} from "react";
import {type LibraryDetailsItem, type LibraryIndexItem} from "./library";
import {screenshotThumbnailUrl, screenshotUrl} from "./library-urls";
import classNames from "classnames";
import {type Appearance} from "./controls/Appearance";
import {Button} from "./controls/Button";

export function MacLibraryScreenshots({
    item,
    details,
    appearance,
}: {
    item: LibraryIndexItem;
    details: LibraryDetailsItem;
    appearance: Appearance;
}) {
    const {screenshots} = details;
    const carouselRef = useRef<HTMLDivElement>(null);
    const [currentIndex, setCurrentIndex] = useState(0);

    const scrollToImage = (index: number) => {
        if (carouselRef.current) {
            const scrollWidth = carouselRef.current.scrollWidth;
            const imageWidth = scrollWidth / screenshots.length;
            carouselRef.current.scrollTo({
                left: imageWidth * index,
                behavior: "smooth",
            });
        }
    };

    const handleScroll = () => {
        if (carouselRef.current) {
            const scrollLeft = carouselRef.current.scrollLeft;
            const imageWidth =
                carouselRef.current.scrollWidth / screenshots.length;
            const newIndex = Math.round(scrollLeft / imageWidth);
            setCurrentIndex(newIndex);
        }
    };

    const nextImage = () => {
        const newIndex = (currentIndex + 1) % screenshots.length;
        scrollToImage(newIndex);
    };

    const prevImage = () => {
        const newIndex =
            (currentIndex - 1 + screenshots.length) % screenshots.length;
        scrollToImage(newIndex);
    };

    return (
        <div className="Mac-Library-Screenshots">
            <div ref={carouselRef} onScroll={handleScroll} className="carousel">
                {screenshots.map((s, i) => (
                    <a href={screenshotUrl(s)} target="_blank" key={s}>
                        <img
                            src={screenshotThumbnailUrl(s)}
                            alt={`{Screenshot ${i + 1}`}
                        />
                    </a>
                ))}
            </div>
            {screenshots.length > 1 && (
                <div className="controls">
                    <Button
                        appearance={appearance}
                        onClick={prevImage}
                        aria-label="Previous screenshot">
                        ‹
                    </Button>
                    <div className="dot-indicators">
                        {screenshots.map((_, index) => (
                            <button
                                key={index}
                                onClick={() => scrollToImage(index)}
                                className={classNames("dot", {
                                    "active": index === currentIndex,
                                })}
                                aria-label={`Go to screenshot ${index + 1}`}
                            />
                        ))}
                    </div>
                    <Button
                        appearance={appearance}
                        onClick={nextImage}
                        aria-label="Next screenshot">
                        ›
                    </Button>
                </div>
            )}
        </div>
    );
}
