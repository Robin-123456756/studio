import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Star, ThumbsUp, ThumbsDown } from "lucide-react";

const reviews = [
  {
    id: 1,
    name: "Alex Johnson",
    avatar: "https://picsum.photos/seed/review1/100/100",
    rating: 5,
    title: "Best League App Ever!",
    comment: "This app is amazing. It's so easy to keep track of schedules, scores, and my fantasy team. The interface is clean and intuitive. Highly recommended for any league manager!",
    likes: 12,
    dislikes: 0,
  },
  {
    id: 2,
    name: "Samantha Lee",
    avatar: "https://picsum.photos/seed/review2/100/100",
    rating: 4,
    title: "Almost Perfect",
    comment: "I really like this app. It has all the features I need. The only thing I wish it had was a way to chat with other team coaches directly. Other than that, it's fantastic.",
    likes: 8,
    dislikes: 1,
  },
  {
    id: 3,
    name: "Michael Chen",
    avatar: "https://picsum.photos/seed/review3/100/100",
    rating: 3,
    title: "Good, but could use improvements",
    comment: "A solid app for league management. However, it can be a bit slow to load sometimes, especially on the fantasy page. Also, more customization options for the dashboard would be great.",
    likes: 3,
    dislikes: 2,
  },
];

const StarRating = ({ rating }: { rating: number }) => (
  <div className="flex items-center">
    {[...Array(5)].map((_, i) => (
      <Star
        key={i}
        className={`h-5 w-5 ${i < rating ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground/50'}`}
      />
    ))}
  </div>
);

export default function ReviewsPage() {
  return (
    <div className="space-y-8 animate-in fade-in-50">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-headline font-bold tracking-tight">User Reviews</h2>
          <p className="text-muted-foreground">See what others are saying about the Budo League app.</p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <h3 className="text-xl font-semibold">Latest Feedback</h3>
          {reviews.map((review) => (
            <Card key={review.id}>
              <CardHeader className="flex flex-row items-start gap-4">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={review.avatar} alt={review.name} data-ai-hint="person avatar" />
                  <AvatarFallback>{review.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold">{review.name}</h4>
                    <StarRating rating={review.rating} />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">{review.title}</p>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-foreground/80">{review.comment}</p>
              </CardContent>
              <CardFooter className="flex justify-end gap-4">
                <Button variant="ghost" size="sm" className="flex items-center gap-2">
                  <ThumbsUp className="h-4 w-4" />
                  <span>{review.likes}</span>
                </Button>
                <Button variant="ghost" size="sm" className="flex items-center gap-2">
                  <ThumbsDown className="h-4 w-4" />
                  <span>{review.dislikes}</span>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Leave a Review</CardTitle>
              <CardDescription>Share your thoughts about the app.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div>
                    <p className="text-sm font-medium mb-2">Your Rating</p>
                    <div className="flex items-center space-x-1">
                        {[...Array(5)].map((_, i) => (
                            <Button key={i} variant="ghost" size="icon">
                                <Star className="h-6 w-6 text-muted-foreground/50" />
                            </Button>
                        ))}
                    </div>
                </div>
                <Textarea placeholder="Tell us what you think..." rows={5} />
            </CardContent>
            <CardFooter>
              <Button className="w-full">Submit Review</Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
