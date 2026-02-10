import useEmblaCarousel, { type UseEmblaCarouselType } from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import * as React from "react";

import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

type CarouselApi = UseEmblaCarouselType[1];
type UseCarouselParameters = Parameters<typeof useEmblaCarousel>;
type CarouselOptions = UseCarouselParameters[0];
type CarouselPlugin = UseCarouselParameters[1];

type CarouselProps = {
  opts?: CarouselOptions;
  plugins?: CarouselPlugin;
  orientation?: "horizontal" | "vertical";
  setApi?: (api: CarouselApi) => void;
};

type CarouselContextProps = {
  carouselRef: ReturnType<typeof useEmblaCarousel>[0];
  api: ReturnType<typeof useEmblaCarousel>[1];
  scrollPrev: () => void;
  scrollNext: () => void;
  canScrollPrev: boolean;
  canScrollNext: boolean;
} & CarouselProps;

const CarouselContext = React.createContext<CarouselContextProps | null>(null);

function useCarousel() {
  const context = React.useContext(CarouselContext);

  if (!context) {
    throw new Error("useCarousel must be used within a <Carousel />");
  }

  return context;
}

const Carousel = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & CarouselProps
>(({ orientation = "horizontal", opts, setApi, plugins, className, children, ...props }, ref) => {
  const [carouselRef, api] = useEmblaCarousel(
    {
      ...opts,
      axis: orientation === "horizontal" ? "x" : "y",
    },
    plugins,
  );
  const [canScrollPrev, setCanScrollPrev] = React.useState(false);
  const [canScrollNext, setCanScrollNext] = React.useState(false);

  const onSelect = React.useCallback((api: CarouselApi) => {
    if (!api) {
      return;
    }

    setCanScrollPrev(api.canScrollPrev());
    setCanScrollNext(api.canScrollNext());
  }, []);

  const scrollPrev = React.useCallback(() => {
    api?.scrollPrev();
  }, [api]);

  const scrollNext = React.useCallback(() => {
    api?.scrollNext();
  }, [api]);

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        scrollPrev();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        scrollNext();
      }
    },
    [scrollPrev, scrollNext],
  );

  React.useEffect(() => {
    if (!api || !setApi) {
      return;
    }

    setApi(api);
  }, [api, setApi]);

  React.useEffect(() => {
    if (!api) {
      return;
    }

    onSelect(api);
    api.on("reInit", onSelect);
    api.on("select", onSelect);

    return () => {
      api?.off("select", onSelect);
    };
  }, [api, onSelect]);

  return (
    <CarouselContext.Provider
      value={{
        carouselRef,
        api: api,
        opts,
        orientation: orientation || (opts?.axis === "y" ? "vertical" : "horizontal"),
        scrollPrev,
        scrollNext,
        canScrollPrev,
        canScrollNext,
      }}
    >
      <div
        ref={ref}
        onKeyDownCapture={handleKeyDown}
        className={cn("relative", className)}
        role="region"
        aria-roledescription="carousel"
        {...props}
      >
        {children}
      </div>
    </CarouselContext.Provider>
  );
});
Carousel.displayName = "Carousel";

type CarouselContentProps = React.HTMLAttributes<HTMLDivElement> & {
  viewportClassName?: string;
};

const CarouselContent = React.forwardRef<HTMLDivElement, CarouselContentProps>(
  ({ className, viewportClassName, onWheel, ...props }, ref) => {
    const { carouselRef, orientation, scrollNext, scrollPrev } = useCarousel();
    const wheelState = React.useRef({ direction: 0, count: 0, timer: null as ReturnType<typeof setTimeout> | null });

    React.useEffect(() => {
      const timer = wheelState.current.timer;
      return () => {
        if (timer) clearTimeout(timer);
      };
    }, []);

    const handleWheel = React.useCallback(
      (event: React.WheelEvent<HTMLDivElement>) => {
        if (orientation !== "horizontal") {
          onWheel?.(event);
          return;
        }

        const { deltaX, deltaY } = event;

        if (Math.abs(deltaX) <= Math.abs(deltaY)) {
          onWheel?.(event);
          return;
        }

        event.preventDefault();

        const state = wheelState.current;
        const direction = deltaX > 0 ? 1 : -1;

        if (state.direction !== direction) {
          state.direction = direction;
          state.count = 0;
        }

        if (state.count < 3) {
          state.count += 1;
          direction > 0 ? scrollNext() : scrollPrev();
        }

        if (state.timer) clearTimeout(state.timer);
        state.timer = setTimeout(() => {
          state.count = 0;
          state.direction = 0;
          state.timer = null;
        }, 200);

        onWheel?.(event);
      },
      [orientation, onWheel, scrollNext, scrollPrev],
    );

    return (
      <div
        ref={carouselRef}
        className={cn("overflow-y-visible", viewportClassName)}
        onWheel={handleWheel}
      >
        <div
          ref={ref}
          className={cn("flex", { "flex-col": orientation === "vertical" }, className)}
          {...props}
        />
      </div>
    );
  },
);
CarouselContent.displayName = "CarouselContent";

const CarouselItem = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        role="group"
        aria-roledescription="slide"
        className={cn(className, "grow-0 basis-full")}
        {...props}
      />
    );
  },
);
CarouselItem.displayName = "CarouselItem";

const CarouselPrevious = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<typeof Button> & { iconSize?: number; iconClassName?: string }
>(
  (
    { className, variant = "outline", size = "icon", iconSize = 16, iconClassName, ...props },
    ref,
  ) => {
    const { scrollPrev, canScrollPrev } = useCarousel();

    return (
      <Button
        ref={ref}
        variant={variant}
        size={size}
        className={cn(className)}
        disabled={!canScrollPrev}
        onClick={scrollPrev}
        {...props}
      >
        <ChevronLeft size={iconSize} className={cn("text-black", iconClassName)} />
        <span className="sr-only">Previous slide</span>
      </Button>
    );
  },
);
CarouselPrevious.displayName = "CarouselPrevious";

const CarouselNext = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<typeof Button> & { iconSize?: number; iconClassName?: string }
>(
  ({ className, variant = "outline", size = "icon", iconSize = 16, iconClassName, ...props }, ref) => {
    const { scrollNext, canScrollNext } = useCarousel();

    return (
      <Button
        ref={ref}
        variant={variant}
        size={size}
        className={cn(className)}
        disabled={!canScrollNext}
        onClick={scrollNext}
        {...props}
      >
        <ChevronRight size={iconSize} className={cn("text-black", iconClassName)} />
        <span className="sr-only">Next slide</span>
      </Button>
    );
  },
);
CarouselNext.displayName = "CarouselNext";

export {
  type CarouselApi,
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
};
